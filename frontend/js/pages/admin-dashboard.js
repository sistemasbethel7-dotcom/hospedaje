import { registerServiceWorker } from '../app.js';
import { me, listarEventos, obtenerMetricasEvento, listarHogares } from '../services/api.js';
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

const HOUSE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const KPI_INFO = {
  hogares: {
    titulo: 'Hogares registrados',
    filtro: (h) => true,
    orden: (a, b) => 0,
    metrica: (h) => `${h.ocupacion_actual}/${h.capacidad} lugares ocupados`,
  },
  capacidad: {
    titulo: 'Capacidad por hogar',
    filtro: (h) => true,
    orden: (a, b) => b.capacidad - a.capacidad,
    metrica: (h) => `Capacidad: ${h.capacidad} lugares`,
  },
  ocupacion: {
    titulo: 'Hogares con ocupación',
    filtro: (h) => h.ocupacion_actual > 0,
    orden: (a, b) => b.ocupacion_actual - a.ocupacion_actual,
    metrica: (h) => `${h.ocupacion_actual}/${h.capacidad} lugares ocupados`,
  },
  disponibles: {
    titulo: 'Hogares con lugares disponibles',
    filtro: (h) => h.capacidad - h.ocupacion_actual > 0,
    orden: (a, b) => (b.capacidad - b.ocupacion_actual) - (a.capacidad - a.ocupacion_actual),
    metrica: (h) => `${h.capacidad - h.ocupacion_actual} lugares disponibles de ${h.capacidad}`,
  },
};

const charts = {};
let eventos = [];
let hogaresActuales = [];
let kpiModalActivo = null;
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

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderKpiModal(tipo) {
  const info = KPI_INFO[tipo];
  document.getElementById('kpi-modal-title').textContent = info.titulo;

  const body = document.getElementById('kpi-modal-body');
  const hogares = hogaresActuales.filter(info.filtro).sort(info.orden);

  if (hogares.length === 0) {
    body.innerHTML = '<p class="admin-modal-empty">No hay hogares en esta categoría.</p>';
    return;
  }

  body.innerHTML = hogares
    .map((h) => {
      const thumbStyle = h.foto_fachada ? `style="background-image:url(/uploads/${h.foto_fachada})"` : '';
      const thumbContent = h.foto_fachada ? '' : HOUSE_ICON;
      return `
        <div class="admin-modal-row">
          <div class="admin-modal-thumb" ${thumbStyle}>${thumbContent}</div>
          <div class="admin-modal-info">
            <div class="admin-modal-nombre">${escapeHtml(h.nombre_dueno)}</div>
            <div class="admin-modal-direccion">${escapeHtml(h.calle_numero)}, ${escapeHtml(h.colonia)}</div>
            <div class="admin-modal-metric">${info.metrica(h)}</div>
          </div>
          <a class="admin-modal-link" href="../hogar-detalle.html?id=${h.id}&from=admin" target="_blank" rel="noopener">Ver / Editar</a>
        </div>
      `;
    })
    .join('');
}

function abrirKpiModal(tipo) {
  kpiModalActivo = tipo;
  renderKpiModal(tipo);
  document.getElementById('kpi-modal-backdrop').hidden = false;
}

function cerrarKpiModal() {
  kpiModalActivo = null;
  document.getElementById('kpi-modal-backdrop').hidden = true;
}

document.querySelectorAll('.admin-kpi-card').forEach((card) => {
  card.addEventListener('click', () => abrirKpiModal(card.dataset.kpi));
});

document.getElementById('kpi-modal-close').addEventListener('click', cerrarKpiModal);
document.getElementById('kpi-modal-backdrop').addEventListener('click', (event) => {
  if (event.target.id === 'kpi-modal-backdrop') cerrarKpiModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && kpiModalActivo) cerrarKpiModal();
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
    const [{ metricas }, { hogares }] = await Promise.all([
      obtenerMetricasEvento(session.token, eventoId),
      listarHogares(session.token, eventoId),
    ]);
    document.getElementById('dashboard-content').hidden = false;
    renderMetricas(metricas);
    hogaresActuales = hogares;
    if (kpiModalActivo) renderKpiModal(kpiModalActivo);
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
