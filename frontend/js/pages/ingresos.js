import { registerServiceWorker } from '../app.js';
import { listarHogares, registrarIngreso, obtenerEvento } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

const eventoId = getActiveEventId();
if (!eventoId) {
  window.location.href = 'eventos.html';
}

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'home.html';
});

const HOUSE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

let hogares = [];
let selected = null;
let cantidad = 1;

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function disponibles(h) {
  return h.capacidad - h.ocupacion_actual;
}

function renderList() {
  const list = document.getElementById('hogares-list');

  if (hogares.length === 0) {
    list.innerHTML = '<p class="hogares-empty">Aún no hay hogares registrados.</p>';
    return;
  }

  list.innerHTML = hogares
    .map((h) => {
      const isSelected = selected?.id === h.id;
      const isFull = disponibles(h) <= 0;
      const thumbStyle = h.foto_fachada ? `style="background-image:url(/uploads/${h.foto_fachada})"` : '';
      const thumbContent = h.foto_fachada ? '' : HOUSE_ICON;
      return `
        <div class="card-bordered hogar-card selectable ${isSelected ? 'selected' : ''}" data-id="${h.id}" style="${isFull ? 'opacity:.5' : ''}">
          <div class="hogar-thumb" ${thumbStyle}>${thumbContent}</div>
          <div class="hogar-info">
            <div class="hogar-nombre">${escapeHtml(h.nombre_dueno)}</div>
            <div class="hogar-direccion">${escapeHtml(h.calle_numero)}, ${escapeHtml(h.colonia)}</div>
            <div class="hogar-ocupacion">${isFull ? 'Sin lugares disponibles' : `${disponibles(h)} lugares disponibles`}</div>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('.hogar-card').forEach((card) => {
    card.addEventListener('click', () => {
      const hogar = hogares.find((h) => h.id === Number(card.dataset.id));
      if (disponibles(hogar) <= 0) return;
      selected = hogar;
      cantidad = 1;
      renderList();
      renderPanel();
    });
  });
}

function renderPanel() {
  const panel = document.getElementById('ingresos-panel');
  if (!selected) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  document.getElementById('panel-nombre').textContent = selected.nombre_dueno;
  document.getElementById('panel-sub').textContent = `${disponibles(selected)} lugares disponibles de ${selected.capacidad}`;
  const input = document.getElementById('ingreso-valor');
  input.value = cantidad;
  input.max = disponibles(selected);
  document.getElementById('ingreso-error').textContent = '';
}

function clampCantidad(value) {
  return Math.min(disponibles(selected), Math.max(1, value));
}

document.getElementById('ingreso-menos').addEventListener('click', () => {
  cantidad = clampCantidad(cantidad - 1);
  document.getElementById('ingreso-valor').value = cantidad;
});

document.getElementById('ingreso-mas').addEventListener('click', () => {
  cantidad = clampCantidad(cantidad + 1);
  document.getElementById('ingreso-valor').value = cantidad;
});

document.getElementById('ingreso-valor').addEventListener('input', (event) => {
  const value = parseInt(event.target.value, 10);
  if (!Number.isNaN(value)) {
    cantidad = clampCantidad(value);
  }
});

document.getElementById('ingreso-valor').addEventListener('blur', (event) => {
  event.target.value = cantidad;
});

document.getElementById('ingreso-valor').addEventListener('focus', (event) => {
  event.target.select();
});

document.getElementById('confirmar-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('ingreso-error');
  const btn = document.getElementById('confirmar-btn');
  errorEl.textContent = '';
  btn.disabled = true;

  try {
    const { hogar } = await registrarIngreso(session.token, selected.id, cantidad);
    const idx = hogares.findIndex((h) => h.id === hogar.id);
    hogares[idx] = { ...hogares[idx], ocupacion_actual: hogar.ocupacion_actual };
    selected = null;
    renderList();
    renderPanel();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = 'index.html';
      return;
    }
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

try {
  const data = await listarHogares(session.token, eventoId);
  hogares = data.hogares;
  renderList();
  obtenerEvento(session.token, eventoId)
    .then(({ evento }) => {
      document.getElementById('evento-context').textContent = `Evento: ${evento.nombre}`;
    })
    .catch(() => {});
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = 'index.html';
  } else {
    document.getElementById('ingresos-list-error').textContent = 'No se pudo cargar la lista de hogares.';
  }
}
