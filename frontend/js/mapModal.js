const STREET_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DEFAULT_CENTER = [20.6597, -103.3496];

export function setupMapModal({ getLocation, onConfirm }) {
  let modalMap = null;
  let streetLayer = null;
  let satelliteLayer = null;
  let activeLayer = null;

  function ensureModalMap() {
    if (modalMap) return;

    streetLayer = L.tileLayer(STREET_URL, { attribution: 'Tiles © Esri', maxZoom: 19 });
    satelliteLayer = L.tileLayer(SATELLITE_URL, { attribution: 'Tiles © Esri', maxZoom: 19 });

    const location = getLocation();
    const initialCenter = location ? [location.lat, location.lng] : DEFAULT_CENTER;
    const initialZoom = location ? 19 : 12;

    modalMap = L.map('modal-map').setView(initialCenter, initialZoom);
    activeLayer = streetLayer;
    activeLayer.addTo(modalMap);
  }

  function openMapModal() {
    ensureModalMap();

    if (activeLayer !== streetLayer) {
      modalMap.removeLayer(activeLayer);
      activeLayer = streetLayer;
      activeLayer.addTo(modalMap);
      document.getElementById('map-toggle-view').textContent = 'Satélite';
    }

    document.getElementById('map-modal').hidden = false;
    setTimeout(() => modalMap.invalidateSize(), 50);

    const location = getLocation();
    if (!location && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => modalMap.setView([pos.coords.latitude, pos.coords.longitude], 19),
        () => {}
      );
    }
  }

  function closeMapModal() {
    document.getElementById('map-modal').hidden = true;
  }

  document.getElementById('ubicar-btn').addEventListener('click', openMapModal);
  document.getElementById('map-modal-close').addEventListener('click', closeMapModal);

  document.getElementById('map-toggle-view').addEventListener('click', () => {
    modalMap.removeLayer(activeLayer);
    activeLayer = activeLayer === streetLayer ? satelliteLayer : streetLayer;
    activeLayer.addTo(modalMap);
    document.getElementById('map-toggle-view').textContent = activeLayer === streetLayer ? 'Satélite' : 'Normal';
  });

  document.getElementById('map-locate-btn').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      modalMap.setView([pos.coords.latitude, pos.coords.longitude], 19);
    });
  });

  document.getElementById('map-confirm-btn').addEventListener('click', () => {
    const center = modalMap.getCenter();
    onConfirm(center.lat, center.lng);
    closeMapModal();
  });
}
