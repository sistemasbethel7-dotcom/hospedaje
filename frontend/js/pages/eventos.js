import { registerServiceWorker } from '../app.js';
import { listarEventos } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  clearActiveEventId();
  window.location.href = 'index.html';
});

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatFecha(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function renderEventos(eventos) {
  const list = document.getElementById('eventos-list');

  if (eventos.length === 0) {
    list.innerHTML = '<p class="eventos-empty">No hay eventos por el momento.</p>';
    return;
  }

  list.innerHTML = eventos
    .map(
      (e) => `
        <div class="card-bordered evento-card" data-id="${e.id}">
          <div class="evento-card-head">
            <div>
              <div class="evento-nombre">${escapeHtml(e.nombre)}</div>
              ${e.sede ? `<div class="evento-sede">${escapeHtml(e.sede)}</div>` : ''}
              <div class="evento-fechas">${formatFecha(e.fecha_inicio)} – ${formatFecha(e.fecha_fin)}</div>
            </div>
          </div>
        </div>
      `
    )
    .join('');

  list.querySelectorAll('.evento-card').forEach((card) => {
    card.addEventListener('click', () => {
      setActiveEventId(card.dataset.id);
      window.location.href = 'home.html';
    });
  });
}

try {
  const { eventos } = await listarEventos(session.token, 'abierto');
  renderEventos(eventos);
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = 'index.html';
  } else {
    document.getElementById('eventos-error').textContent = 'No se pudo cargar la lista de eventos.';
  }
}
