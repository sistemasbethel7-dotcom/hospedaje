import { registerServiceWorker } from '../app.js';
import { me, listarEventos, obtenerMetricasEvento } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';
import { subscribeToEvento } from '../services/eventStream.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = '../index.html';
}

// Paleta llamativa a propósito: el dorado del tema se ve bien en botones y
// texto, pero en gráficas se veía apagado y costaba distinguir series/barras.
const AZUL = '#3B82F6';
const MORADO = '#8B5CF6';
const ROSA = '#EC4899';
const NARANJA = '#F97316';
const CIAN = '#06B6D4';
const AMARILLO = '#FBBF24';
const VERDE = '#22C55E';
const ROJO = '#EF4444';
const PALETTE = [AZUL, MORADO, ROSA, NARANJA, CIAN, AMARILLO, VERDE, ROJO];

const charts = {};
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
  cargarMetricas(event.target.value);
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
      refrescoPendiente = setTimeout(() => cargarMetricas(eventoId), 500);
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

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }
}

function renderMetricas(metricas) {
  document.getElementById('kpi-hogares').textContent = metricas.total_hogares;
  document.getElementById('kpi-capacidad').textContent = metricas.capacidad_total;
  document.getElementById('kpi-ocupacion').textContent = metricas.ocupacion_total;
  document.getElementById('kpi-disponibles').textContent = Math.max(0, metricas.capacidad_total - metricas.ocupacion_total);

  destroyChart('ocupacion');
  charts.ocupacion = new Chart(document.getElementById('chart-ocupacion'), {
    type: 'doughnut',
    data: {
      labels: ['Ocupados', 'Disponibles'],
      datasets: [{
        data: [metricas.ocupacion_total, Math.max(0, metricas.capacidad_total - metricas.ocupacion_total)],
        backgroundColor: [ROJO, VERDE],
      }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  });

  destroyChart('colonias');
  charts.colonias = new Chart(document.getElementById('chart-colonias'), {
    type: 'bar',
    data: {
      labels: metricas.colonias.map((c) => c.colonia),
      datasets: [
        { label: 'Capacidad', data: metricas.colonias.map((c) => c.capacidad), backgroundColor: NARANJA },
        { label: 'Ocupación', data: metricas.colonias.map((c) => c.ocupacion), backgroundColor: AZUL },
      ],
    },
    options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' } }, scales: { x: { beginAtZero: true } } },
  });

  destroyChart('servicios');
  charts.servicios = new Chart(document.getElementById('chart-servicios'), {
    type: 'bar',
    data: {
      labels: metricas.servicios.map((s) => s.etiqueta),
      datasets: [{ data: metricas.servicios.map((s) => s.total), backgroundColor: PALETTE }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  destroyChart('vulnerabilidades');
  charts.vulnerabilidades = new Chart(document.getElementById('chart-vulnerabilidades'), {
    type: 'bar',
    data: {
      labels: metricas.vulnerabilidades.map((v) => v.etiqueta),
      datasets: [{ data: metricas.vulnerabilidades.map((v) => v.total), backgroundColor: ROJO }],
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  });

  destroyChart('perfiles');
  charts.perfiles = new Chart(document.getElementById('chart-perfiles'), {
    type: 'bar',
    data: {
      labels: metricas.perfiles.map((p) => p.etiqueta),
      datasets: [{ data: metricas.perfiles.map((p) => p.total), backgroundColor: MORADO }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

async function cargarMetricas(eventoId) {
  const errorEl = document.getElementById('dashboard-error');
  errorEl.textContent = '';
  try {
    const { metricas } = await obtenerMetricasEvento(session.token, eventoId);
    document.getElementById('dashboard-content').hidden = false;
    renderMetricas(metricas);
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = 'No se pudieron cargar las métricas de este evento.';
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
  }

  const { eventos: lista } = await listarEventos(session.token);
  eventos = lista;

  if (eventos.length === 0) {
    document.getElementById('dashboard-empty').hidden = false;
  } else {
    poblarSelect();
    const activo = getActiveEventId();
    const inicial = eventos.find((e) => String(e.id) === activo) || eventos.find((e) => e.estatus === 'abierto') || eventos[0];
    document.getElementById('evento-select').value = inicial.id;
    setActiveEventId(inicial.id);
    await cargarMetricas(inicial.id);
    suscribirEvento(inicial.id);
  }
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = '../index.html';
  } else {
    document.getElementById('dashboard-error').textContent = 'No se pudo cargar la información del dashboard.';
  }
}
