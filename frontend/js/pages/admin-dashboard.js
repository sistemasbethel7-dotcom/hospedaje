import { me, listarEventos, obtenerMetricasEvento, listarHogares, obtenerHogar } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';
import { subscribeToEvento } from '../services/eventStream.js';
import { folioDe, renderDetalleHogarHTML, renderHogaresTablaHTML } from '../hogarDetalleView.js';

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

const KPI_INFO = {
  hogares: {
    titulo: 'Hogares registrados',
    filtro: () => true,
    orden: () => 0,
  },
  capacidad: {
    titulo: 'Capacidad por hogar',
    filtro: () => true,
    orden: (a, b) => b.capacidad - a.capacidad,
  },
  ocupacion: {
    titulo: 'Hogares con ocupación',
    filtro: (h) => h.ocupacion_actual > 0,
    orden: (a, b) => b.ocupacion_actual - a.ocupacion_actual,
  },
  disponibles: {
    titulo: 'Hogares con lugares disponibles',
    filtro: (h) => h.capacidad - h.ocupacion_actual > 0,
    orden: (a, b) => (b.capacidad - b.ocupacion_actual) - (a.capacidad - a.ocupacion_actual),
  },
};

let session = null;
const charts = {};
let eventos = [];
let hogaresActuales = [];
let kpiModalActivo = null;
let detalleModalAbierto = false;
let unsubscribeStream = null;
let refrescoPendiente = null;
let filtroEstatus = 'abierto';
let onKeydown = null;

function renderKpiModal(tipo) {
  const info = KPI_INFO[tipo];
  document.getElementById('kpi-modal-title').textContent = info.titulo;

  const body = document.getElementById('kpi-modal-body');
  const hogares = hogaresActuales.filter(info.filtro).sort(info.orden);
  body.innerHTML = renderHogaresTablaHTML(hogares);

  body.querySelectorAll('tr[data-hogar-id]').forEach((row) => {
    row.addEventListener('click', () => abrirHogar(row.dataset.hogarId));
  });
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

function renderDetalleHogar(hogar) {
  document.getElementById('detalle-modal-title').textContent = `${hogar.nombre_dueno} · ${folioDe(hogar.id)}`;
  document.getElementById('detalle-modal-body').innerHTML = renderDetalleHogarHTML(hogar);
}

export async function abrirHogar(id) {
  document.getElementById('detalle-modal-title').textContent = 'Cargando…';
  document.getElementById('detalle-modal-body').innerHTML = '';
  detalleModalAbierto = true;
  document.getElementById('detalle-modal-backdrop').hidden = false;
  try {
    const { hogar } = await obtenerHogar(session.token, id);
    renderDetalleHogar(hogar);
  } catch (err) {
    document.getElementById('detalle-modal-body').innerHTML =
      '<p class="admin-modal-empty">No se pudo cargar el detalle de este hogar.</p>';
  }
}

function cerrarDetalleModal() {
  detalleModalAbierto = false;
  document.getElementById('detalle-modal-backdrop').hidden = true;
}

function setLiveStatus(estado) {
  const indicator = document.getElementById('live-indicator');
  const text = document.getElementById('live-indicator-text');
  indicator.hidden = false;
  indicator.classList.toggle('reconectando', estado === 'reconectando');
  indicator.classList.toggle('inactivo', estado === 'inactivo');
  if (estado === 'inactivo') {
    text.textContent = 'Evento finalizado';
  } else if (estado === 'reconectando') {
    text.textContent = 'Reconectando…';
  } else {
    text.textContent = 'En vivo';
  }
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

function eventosFiltrados() {
  return eventos.filter((e) => e.estatus === filtroEstatus);
}

function actualizarTabs() {
  const abiertos = eventos.filter((e) => e.estatus === 'abierto').length;
  const finalizados = eventos.filter((e) => e.estatus === 'finalizado').length;
  document.querySelectorAll('.admin-filtro-tab').forEach((btn) => {
    btn.textContent = btn.dataset.filtro === 'abierto' ? `Vigentes (${abiertos})` : `Finalizados (${finalizados})`;
    btn.classList.toggle('active', btn.dataset.filtro === filtroEstatus);
  });
}

function poblarSelect() {
  const select = document.getElementById('evento-select');
  const filtrados = eventosFiltrados();
  if (filtrados.length === 0) {
    const etiqueta = filtroEstatus === 'abierto' ? 'vigentes' : 'finalizados';
    select.innerHTML = `<option value="" disabled selected>Sin eventos ${etiqueta}</option>`;
    return;
  }
  select.innerHTML = filtrados
    .map((e) => `<option value="${e.id}">${e.nombre} (${formatFecha(e.fecha_inicio)})</option>`)
    .join('');
}

function mostrarSinSeleccion() {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  document.getElementById('dashboard-content').hidden = true;
  document.getElementById('dashboard-sin-seleccion').hidden = false;
  document.getElementById('live-indicator').hidden = true;
}

async function seleccionarEvento(eventoId) {
  setActiveEventId(eventoId);
  document.getElementById('dashboard-sin-seleccion').hidden = true;
  await cargarMetricas(eventoId);
  const evento = eventos.find((e) => String(e.id) === String(eventoId));
  if (evento && evento.estatus === 'abierto') {
    suscribirEvento(eventoId);
  } else {
    if (unsubscribeStream) {
      unsubscribeStream();
      unsubscribeStream = null;
    }
    setLiveStatus('inactivo');
  }
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

export async function mount() {
  session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  eventos = [];
  hogaresActuales = [];
  kpiModalActivo = null;
  detalleModalAbierto = false;
  filtroEstatus = 'abierto';

  document.getElementById('evento-select').addEventListener('change', (event) => {
    if (!event.target.value) return;
    seleccionarEvento(event.target.value);
  });

  document.querySelectorAll('.admin-filtro-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtroEstatus = btn.dataset.filtro;
      actualizarTabs();
      poblarSelect();
      const filtrados = eventosFiltrados();
      if (filtrados.length > 0) {
        document.getElementById('evento-select').value = filtrados[0].id;
        seleccionarEvento(filtrados[0].id);
      } else {
        mostrarSinSeleccion();
      }
    });
  });

  document.querySelectorAll('.admin-kpi-card').forEach((card) => {
    card.addEventListener('click', () => abrirKpiModal(card.dataset.kpi));
  });
  document.getElementById('kpi-modal-close').addEventListener('click', cerrarKpiModal);
  document.getElementById('kpi-modal-backdrop').addEventListener('click', (event) => {
    if (event.target.id === 'kpi-modal-backdrop') cerrarKpiModal();
  });
  document.getElementById('detalle-modal-close').addEventListener('click', cerrarDetalleModal);
  document.getElementById('detalle-modal-backdrop').addEventListener('click', (event) => {
    if (event.target.id === 'detalle-modal-backdrop') cerrarDetalleModal();
  });

  onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (detalleModalAbierto) {
      cerrarDetalleModal();
    } else if (kpiModalActivo) {
      cerrarKpiModal();
    }
  };
  document.addEventListener('keydown', onKeydown);

  try {
    const { user } = await me(session.token);
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      window.location.href = '../eventos.html';
      return;
    }
    if (user.role !== 'admin') {
      document.getElementById('nav-usuarios').hidden = true;
      document.getElementById('nav-catalogos').hidden = true;
      document.getElementById('nav-agente').hidden = true;
    }

    const { eventos: lista } = await listarEventos(session.token);
    eventos = lista;

    if (eventos.length === 0) {
      document.getElementById('dashboard-empty').hidden = false;
    } else {
      const vigentes = eventos.filter((e) => e.estatus === 'abierto');

      if (vigentes.length > 0) {
        filtroEstatus = 'abierto';
        actualizarTabs();
        poblarSelect();
        const activo = getActiveEventId();
        const inicial = vigentes.find((e) => String(e.id) === activo) || vigentes[0];
        document.getElementById('evento-select').value = inicial.id;
        await seleccionarEvento(inicial.id);
      } else {
        filtroEstatus = 'abierto';
        actualizarTabs();
        poblarSelect();
        mostrarSinSeleccion();
      }
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
}

export function unmount() {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  clearTimeout(refrescoPendiente);
  ['ocupacion', 'colonias', 'servicios', 'vulnerabilidades', 'perfiles'].forEach(destroyChart);
  if (onKeydown) {
    document.removeEventListener('keydown', onKeydown);
    onKeydown = null;
  }
}
