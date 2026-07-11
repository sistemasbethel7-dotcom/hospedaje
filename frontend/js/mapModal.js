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

  // En Safari móvil, un modal `position: fixed; inset: 0` se dimensiona contra el
  // viewport de layout (pantalla completa, barra de Safari colapsada), no contra lo
  // que realmente se ve mientras la barra de direcciones sigue expandida. Eso deja la
  // cabecera (título + botón Satélite) tapada hasta que el usuario hace scroll y Safari
  // colapsa su barra. Se corrige midiendo el visualViewport real y ajustando el modal.
  function syncModalViewport() {
    const modal = document.getElementById('map-modal');
    if (modal.hidden) return;
    const vv = window.visualViewport;
    if (vv) {
      modal.style.height = `${vv.height}px`;
      modal.style.top = `${vv.offsetTop}px`;
    } else {
      modal.style.height = `${window.innerHeight}px`;
      modal.style.top = '0px';
    }
    modalMap?.invalidateSize();
  }

  window.visualViewport?.addEventListener('resize', syncModalViewport);
  window.visualViewport?.addEventListener('scroll', syncModalViewport);

  function openMapModal() {
    ensureModalMap();

    if (activeLayer !== streetLayer) {
      modalMap.removeLayer(activeLayer);
      activeLayer = streetLayer;
      activeLayer.addTo(modalMap);
      document.getElementById('map-toggle-view').textContent = 'Satélite';
    }

    document.getElementById('map-modal').hidden = false;
    syncModalViewport();
    setTimeout(syncModalViewport, 50);

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
