import { registerServiceWorker } from '../app.js';
import { me, listarEventos, listarHogares } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';
import { subscribeToEvento } from '../services/eventStream.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = '../index.html';
}

const STREET_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const DEFAULT_CENTER = [20.6597, -103.3496];

// Semáforo estándar (no la paleta dorada del tema): aquí el color es información
// de estatus, no decoración, así que debe leerse como verde/amarillo/rojo real.
const COLOR_LIBRE = '#22C55E';
const COLOR_PARCIAL = '#FBBF24';
const COLOR_LLENO = '#EF4444';

let map = null;
let markersLayer = null;
let eventos = [];
let unsubscribeStream = null;
let refrescoPendiente = null;

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  clearActiveEventId();
  window.location.href = '../index.html';
});

document.getElementById('evento-select').addEventListener('change', (event) => {
  setActiveEventId(event.target.value);
  cargarMapa(event.target.value);
  suscribirEvento(event.target.value);
});

function setLiveStatus(estado) {
  const indicator = document.getElementById('live-indicator');
  const text = document.getElementById('live-indicator-text');
  indicator.hidden = false;
  indicator.classList.toggle('reconectando', estado === 'reconectando');
  text.textContent = estado === 'reconectando' ? 'Reconectando…' : 'En vivo';
}

function suscribirEvento(eventoId) {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  unsubscribeStream = subscribeToEvento(session.token, eventoId, {
    onStatusChange: setLiveStatus,
    onUpdate: () => {
      clearTimeout(refrescoPendiente);
      refrescoPendiente = setTimeout(() => cargarMapa(eventoId), 500);
    },
  });
}

function formatFecha(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function poblarSelect() {
  const select = document.getElementById('evento-select');
  select.innerHTML = eventos
    .map((e) => `<option value="${e.id}">${e.nombre} (${formatFecha(e.fecha_inicio)} · ${e.estatus})</option>`)
    .join('');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function ensureMap() {
  if (map) return;
  map = L.map('mapa').setView(DEFAULT_CENTER, 12);
  L.tileLayer(STREET_URL, { attribution: 'Tiles © Esri', maxZoom: 19 }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function estatusHogar(h) {
  if (h.ocupacion_actual <= 0) return 'libre';
  if (h.ocupacion_actual >= h.capacidad) return 'lleno';
  return 'parcial';
}

function colorPorEstatus(estatus) {
  if (estatus === 'libre') return COLOR_LIBRE;
  if (estatus === 'lleno') return COLOR_LLENO;
  return COLOR_PARCIAL;
}

function renderHogares(hogares) {
  ensureMap();
  markersLayer.clearLayers();

  const conUbicacion = hogares.filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number');
  const sinUbicacion = hogares.length - conUbicacion.length;

  const sinUbicacionEl = document.getElementById('mapa-sin-ubicacion');
  if (sinUbicacion > 0) {
    sinUbicacionEl.hidden = false;
    sinUbicacionEl.textContent = `${sinUbicacion} sin ubicación registrada`;
  } else {
    sinUbicacionEl.hidden = true;
  }

  conUbicacion.forEach((h) => {
    const marker = L.circleMarker([h.lat, h.lng], {
      radius: 10,
      color: '#fff',
      weight: 2,
      fillColor: colorPorEstatus(estatusHogar(h)),
      fillOpacity: 0.9,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(h.nombre_dueno)}</strong><br>${escapeHtml(h.calle_numero)}, ${escapeHtml(h.colonia)}<br>${h.ocupacion_actual}/${h.capacidad} ocupados`
    );
    markersLayer.addLayer(marker);
  });

  setTimeout(() => map.invalidateSize(), 50);

  if (conUbicacion.length > 0) {
    const bounds = L.latLngBounds(conUbicacion.map((h) => [h.lat, h.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  } else {
    map.setView(DEFAULT_CENTER, 12);
  }
}

async function cargarMapa(eventoId) {
  const errorEl = document.getElementById('mapa-error');
  errorEl.textContent = '';
  try {
    const { hogares } = await listarHogares(session.token, eventoId);
    document.getElementById('mapa-content').hidden = false;
    renderHogares(hogares);
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = 'No se pudo cargar el mapa de este evento.';
  }
}

try {
  const { user } = await me(session.token);
  if (user.role !== 'admin' && user.role !== 'supervisor') {
    window.location.href = '../eventos.html';
  }
  if (user.role !== 'admin') {
    document.getElementById('nav-usuarios').hidden = true;
    document.getElementById('nav-catalogos').hidden = true;
    document.getElementById('nav-agente').hidden = true;
  }

  const { eventos: lista } = await listarEventos(session.token);
  eventos = lista;

  if (eventos.length === 0) {
    document.getElementById('mapa-empty').hidden = false;
  } else {
    poblarSelect();
    const activo = getActiveEventId();
    const inicial = eventos.find((e) => String(e.id) === activo) || eventos.find((e) => e.estatus === 'abierto') || eventos[0];
    document.getElementById('evento-select').value = inicial.id;
    setActiveEventId(inicial.id);
    await cargarMapa(inicial.id);
    suscribirEvento(inicial.id);
  }
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = '../index.html';
  } else {
    document.getElementById('mapa-error').textContent = 'No se pudo cargar la información del mapa.';
  }
}
