import { me, listarEventos, actualizarEvento } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';

const DASHBOARD_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const EDIT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2.121 2.121 0 00-3-3L5 17v3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 6.5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const LOCK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const UNLOCK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 017.94-.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

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
        ? `<button type="button" class="admin-btn outline icon" title="${e.estatus === 'abierto' ? 'Finalizar' : 'Reabrir'}" aria-label="${e.estatus === 'abierto' ? 'Finalizar' : 'Reabrir'}" data-toggle="${e.id}" data-nuevo-estatus="${e.estatus === 'abierto' ? 'finalizado' : 'abierto'}">${e.estatus === 'abierto' ? LOCK_ICON : UNLOCK_ICON}</button>`
        : '';
      const editarAction =
        esAdmin && e.estatus === 'abierto'
          ? `<button type="button" class="admin-btn outline icon" title="Editar" aria-label="Editar" data-editar="${e.id}">${EDIT_ICON}</button>`
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
              <button type="button" class="admin-btn icon" title="Ver dashboard" aria-label="Ver dashboard" data-ver="${e.id}">${DASHBOARD_ICON}</button>
              ${editarAction}
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

  tbody.querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const evento = eventos.find((e) => e.id === Number(btn.dataset.editar));
      if (evento) abrirModalEditar(evento);
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

function abrirModalEditar(evento) {
  document.getElementById('editar-evento-error').textContent = '';
  document.getElementById('ee-nombre').value = evento.nombre;
  document.getElementById('ee-sede').value = evento.sede || '';
  document.getElementById('ee-fecha-inicio').value = evento.fecha_inicio.slice(0, 10);
  document.getElementById('ee-fecha-fin').value = evento.fecha_fin.slice(0, 10);

  const guardarBtn = document.getElementById('editar-evento-guardar-btn');
  guardarBtn.onclick = async () => {
    const errorEl = document.getElementById('editar-evento-error');
    errorEl.textContent = '';

    const nombre = document.getElementById('ee-nombre').value.trim();
    const sede = document.getElementById('ee-sede').value.trim();
    const fechaInicio = document.getElementById('ee-fecha-inicio').value;
    const fechaFin = document.getElementById('ee-fecha-fin').value;

    if (!nombre || !fechaInicio || !fechaFin) {
      errorEl.textContent = 'Completa el nombre y las fechas del evento.';
      return;
    }
    if (fechaFin < fechaInicio) {
      errorEl.textContent = 'La fecha de fin no puede ser anterior a la de inicio.';
      return;
    }

    guardarBtn.disabled = true;
    try {
      await actualizarEvento(session.token, evento.id, {
        nombre,
        sede: sede || null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
      document.getElementById('editar-evento-modal-backdrop').hidden = true;
      await cargarEventos();
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo guardar el evento.';
    } finally {
      guardarBtn.disabled = false;
    }
  };

  document.getElementById('editar-evento-modal-backdrop').hidden = false;
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

  document.getElementById('editar-evento-modal-close').addEventListener('click', () => {
    document.getElementById('editar-evento-modal-backdrop').hidden = true;
  });
  document.getElementById('editar-evento-modal-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) event.currentTarget.hidden = true;
  });

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
