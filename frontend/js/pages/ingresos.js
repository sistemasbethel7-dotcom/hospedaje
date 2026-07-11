import { registerServiceWorker } from '../app.js';
import { listarHogares, registrarIngreso } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'home.html';
});

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
      return `
        <div class="card-bordered hogar-card selectable ${isSelected ? 'selected' : ''}" data-id="${h.id}" style="${isFull ? 'opacity:.5' : ''}">
          <div class="hogar-info">
            <div class="hogar-nombre">${escapeHtml(h.nombre_dueno)}</div>
            <div class="hogar-direccion">${escapeHtml(h.direccion)}</div>
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
  document.getElementById('ingreso-valor').textContent = cantidad;
  document.getElementById('ingreso-error').textContent = '';
}

document.getElementById('ingreso-menos').addEventListener('click', () => {
  cantidad = Math.max(1, cantidad - 1);
  document.getElementById('ingreso-valor').textContent = cantidad;
});

document.getElementById('ingreso-mas').addEventListener('click', () => {
  cantidad = Math.min(disponibles(selected), cantidad + 1);
  document.getElementById('ingreso-valor').textContent = cantidad;
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
      window.location.href = 'index.html';
      return;
    }
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

try {
  const data = await listarHogares(session.token);
  hogares = data.hogares;
  renderList();
} catch (err) {
  if (err.status === 401) {
    clearSession();
    window.location.href = 'index.html';
  } else {
    document.getElementById('ingresos-list-error').textContent = 'No se pudo cargar la lista de hogares.';
  }
}
