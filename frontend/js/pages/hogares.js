import { registerServiceWorker } from '../app.js';
import { listarHogares, obtenerEvento } from '../services/api.js';
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

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderHogares(hogares) {
  const list = document.getElementById('hogares-list');

  if (hogares.length === 0) {
    list.innerHTML = '<p class="hogares-empty">Aún no hay hogares registrados.</p>';
    return;
  }

  list.innerHTML = hogares
    .map((h) => {
      const thumbStyle = h.foto_fachada ? `style="background-image:url(/uploads/${h.foto_fachada})"` : '';
      const thumbContent = h.foto_fachada ? '' : HOUSE_ICON;
      return `
        <button type="button" class="card-bordered hogar-card" data-id="${h.id}">
          <div class="hogar-thumb" ${thumbStyle}>${thumbContent}</div>
          <div class="hogar-info">
            <div class="hogar-nombre">${escapeHtml(h.nombre_dueno)}</div>
            <div class="hogar-direccion">${escapeHtml(h.calle_numero)}, ${escapeHtml(h.colonia)}</div>
            <div class="hogar-ocupacion">${h.ocupacion_actual}/${h.capacidad} lugares ocupados</div>
          </div>
        </button>
      `;
    })
    .join('');

  list.querySelectorAll('.hogar-card').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.href = `hogar-detalle.html?id=${card.dataset.id}`;
    });
  });
}

try {
  const { hogares } = await listarHogares(session.token, eventoId);
  renderHogares(hogares);
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
    document.getElementById('hogares-list').innerHTML =
      '<p class="hogares-empty">No se pudo cargar la lista. Revisa tu conexión.</p>';
  }
}
