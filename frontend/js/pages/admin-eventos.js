import { me, listarEventos, actualizarEvento } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';

let session = null;
let esAdmin = false;
let navigateFn = null;

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
  const wrap = document.getElementById('eventos-table-wrap');
  const empty = document.getElementById('eventos-empty');

  if (eventos.length === 0) {
    wrap.hidden = true;
    empty.hidden = false;
    return;
  }
  wrap.hidden = false;
  empty.hidden = true;

  const tbody = document.getElementById('eventos-tbody');
  tbody.innerHTML = eventos
    .map((e) => {
      const badgeClass = e.estatus === 'abierto' ? '' : 'finalizado';
      const badgeLabel = e.estatus === 'abierto' ? 'Abierto' : 'Finalizado';
      const toggleAction = esAdmin
        ? `<button type="button" class="admin-btn outline" data-toggle="${e.id}" data-nuevo-estatus="${e.estatus === 'abierto' ? 'finalizado' : 'abierto'}">${e.estatus === 'abierto' ? 'Finalizar' : 'Reabrir'}</button>`
        : '';
      return `
        <tr>
          <td>${escapeHtml(e.nombre)}</td>
          <td>${e.sede ? escapeHtml(e.sede) : '—'}</td>
          <td>${formatFecha(e.fecha_inicio)} – ${formatFecha(e.fecha_fin)}</td>
          <td><span class="estatus-badge ${badgeClass}">${badgeLabel}</span></td>
          <td>${e.total_hogares}</td>
          <td>${e.ocupacion_total}/${e.capacidad_total}</td>
          <td>
            <div class="admin-table-actions">
              <button type="button" class="admin-btn" data-ver="${e.id}">Ver dashboard</button>
              ${toggleAction}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-ver]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveEventId(btn.dataset.ver);
      navigateFn('dashboard.html');
    });
  });

  tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await actualizarEvento(session.token, btn.dataset.toggle, { estatus: btn.dataset.nuevoEstatus });
        await cargarEventos();
      } catch (err) {
        document.getElementById('eventos-error').textContent = err.message || 'No se pudo actualizar el evento.';
        btn.disabled = false;
      }
    });
  });
}

async function cargarEventos() {
  const errorEl = document.getElementById('eventos-error');
  errorEl.textContent = '';
  try {
    const { eventos } = await listarEventos(session.token);
    renderEventos(eventos);
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = 'No se pudo cargar la lista de eventos.';
  }
}

export async function mount({ navigate }) {
  session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }
  navigateFn = navigate;
  esAdmin = false;

  try {
    const { user } = await me(session.token);
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      window.location.href = '../eventos.html';
      return;
    }
    esAdmin = user.role === 'admin';
    if (!esAdmin) {
      document.getElementById('nav-usuarios').hidden = true;
      document.getElementById('nav-catalogos').hidden = true;
      document.getElementById('nav-agente').hidden = true;
    } else {
      document.getElementById('crear-evento-btn').hidden = false;
    }

    await cargarEventos();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
    } else {
      document.getElementById('eventos-error').textContent = 'No se pudo cargar la información de sesión.';
    }
  }
}
