import { registerServiceWorker } from '../app.js';
import { me, listarEventos, actualizarEvento } from '../services/api.js';
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

function renderEventos(eventos, { showStats, showFinalizar }) {
  const list = document.getElementById('eventos-list');

  if (eventos.length === 0) {
    list.innerHTML = '<p class="eventos-empty">No hay eventos por el momento.</p>';
    return;
  }

  list.innerHTML = eventos
    .map((e) => {
      const badge = showStats
        ? `<span class="estatus-badge ${e.estatus}">${e.estatus === 'abierto' ? 'Abierto' : 'Finalizado'}</span>`
        : '';
      const stats = showStats
        ? `
          <div class="evento-stats">
            <div class="evento-stat"><span class="evento-stat-valor">${e.total_hogares}</span><span class="evento-stat-label">Hogares</span></div>
            <div class="evento-stat"><span class="evento-stat-valor">${e.ocupacion_total}/${e.capacidad_total}</span><span class="evento-stat-label">Ocupación</span></div>
          </div>
        `
        : '';
      const finalizar =
        showFinalizar && e.estatus === 'abierto'
          ? `<button type="button" class="evento-finalizar-btn" data-finalizar="${e.id}">Finalizar evento</button>`
          : '';
      return `
        <div class="card-bordered evento-card" data-id="${e.id}">
          <div class="evento-card-head">
            <div>
              <div class="evento-nombre">${escapeHtml(e.nombre)}</div>
              ${e.sede ? `<div class="evento-sede">${escapeHtml(e.sede)}</div>` : ''}
              <div class="evento-fechas">${formatFecha(e.fecha_inicio)} – ${formatFecha(e.fecha_fin)}</div>
            </div>
            ${badge}
          </div>
          ${stats}
          ${finalizar}
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('.evento-card').forEach((card) => {
    card.addEventListener('click', () => {
      setActiveEventId(card.dataset.id);
      window.location.href = 'home.html';
    });
  });

  list.querySelectorAll('[data-finalizar]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      btn.disabled = true;
      try {
        await actualizarEvento(session.token, btn.dataset.finalizar, { estatus: 'finalizado' });
        await cargarEventos();
      } catch (err) {
        document.getElementById('eventos-error').textContent = err.message || 'No se pudo finalizar el evento.';
        btn.disabled = false;
      }
    });
  });
}

let userRole = null;

async function cargarEventos() {
  const errorEl = document.getElementById('eventos-error');
  errorEl.textContent = '';
  try {
    const esGestor = userRole === 'admin' || userRole === 'supervisor';
    const { eventos } = await listarEventos(session.token, esGestor ? undefined : 'abierto');
    renderEventos(eventos, { showStats: esGestor, showFinalizar: userRole === 'admin' });
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = 'index.html';
      return;
    }
    errorEl.textContent = 'No se pudo cargar la lista de eventos.';
  }
}

try {
  const { user } = await me(session.token);
  userRole = user.role;

  const esGestor = userRole === 'admin' || userRole === 'supervisor';
  document.getElementById('eventos-heading').textContent = esGestor ? 'Eventos' : 'Eventos por atender';

  if (userRole === 'admin') {
    const addBtn = document.getElementById('crear-evento-btn');
    addBtn.hidden = false;
    addBtn.addEventListener('click', () => {
      window.location.href = 'evento-nuevo.html';
    });
  }

  await cargarEventos();
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = 'index.html';
  } else {
    document.getElementById('eventos-error').textContent = 'No se pudo cargar la información de sesión.';
  }
}
