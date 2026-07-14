import { registerServiceWorker } from '../app.js';
import { me, listarEventos, listarHogares, eliminarHogar } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';
import { subscribeToEvento } from '../services/eventStream.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = '../index.html';
}

const HOUSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
const TRASH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let eventos = [];
let hogaresActuales = [];
let esAdmin = false;
let unsubscribeStream = null;
let refrescoPendiente = null;

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  clearActiveEventId();
  window.location.href = '../index.html';
});

document.getElementById('evento-select').addEventListener('change', (event) => {
  setActiveEventId(event.target.value);
  cargarHogares(event.target.value);
  suscribirEvento(event.target.value);
});

['filtro-dueno', 'filtro-colonia', 'filtro-calle', 'filtro-cp'].forEach((id) => {
  document.getElementById(id).addEventListener('input', renderTabla);
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
      refrescoPendiente = setTimeout(() => cargarHogares(eventoId), 500);
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

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function folioDe(id) {
  return `H-${String(id).padStart(6, '0')}`;
}

function estatusHogar(h) {
  if (h.ocupacion_actual <= 0) return 'libre';
  if (h.ocupacion_actual >= h.capacidad) return 'lleno';
  return 'parcial';
}

function estatusLabel(estatus) {
  if (estatus === 'libre') return 'Libre';
  if (estatus === 'lleno') return 'Lleno';
  return 'Parcial';
}

function comentariosCelda(h) {
  const texto = (h.comentarios || '').trim();
  if (!texto) return '—';
  return escapeHtml(texto).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
}

function ubicacionCelda(h) {
  if (h.lat == null || h.lng == null) return '—';
  const lat = Number(h.lat).toFixed(5);
  const lng = Number(h.lng).toFixed(5);
  return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">${lat}, ${lng}</a>`;
}

function renderTabla() {
  const filtroDueno = document.getElementById('filtro-dueno').value.trim().toLowerCase();
  const filtroColonia = document.getElementById('filtro-colonia').value.trim().toLowerCase();
  const filtroCalle = document.getElementById('filtro-calle').value.trim().toLowerCase();
  const filtroCp = document.getElementById('filtro-cp').value.trim().toLowerCase();

  const hogares = hogaresActuales.filter((h) => {
    if (filtroDueno && !h.nombre_dueno.toLowerCase().includes(filtroDueno)) return false;
    if (filtroColonia && !h.colonia.toLowerCase().includes(filtroColonia)) return false;
    if (filtroCalle && !h.calle_numero.toLowerCase().includes(filtroCalle)) return false;
    if (filtroCp && !(h.codigo_postal || '').toLowerCase().includes(filtroCp)) return false;
    return true;
  });

  const tbody = document.getElementById('hogares-tbody');
  const wrap = document.getElementById('hogares-table-wrap');
  const sinResultados = document.getElementById('hogares-sin-resultados');

  if (hogares.length === 0) {
    wrap.hidden = true;
    sinResultados.hidden = false;
    tbody.innerHTML = '';
    return;
  }
  wrap.hidden = false;
  sinResultados.hidden = true;

  tbody.innerHTML = hogares
    .map((h) => {
      const thumbStyle = h.foto_fachada ? `style="background-image:url(/uploads/${h.foto_fachada})"` : '';
      const thumbContent = h.foto_fachada ? '' : HOUSE_ICON;
      const estatus = estatusHogar(h);
      const eliminarBtn = esAdmin
        ? `<button type="button" class="admin-btn danger icon" title="Eliminar" aria-label="Eliminar" data-eliminar="${h.id}" data-nombre="${escapeHtml(h.nombre_dueno)}">${TRASH_ICON}</button>`
        : '';
      return `
        <tr>
          <td><div class="admin-table-thumb" ${thumbStyle}>${thumbContent}</div></td>
          <td>${folioDe(h.id)}</td>
          <td>${escapeHtml(h.nombre_dueno)}</td>
          <td>${escapeHtml(h.calle_numero)}, ${escapeHtml(h.colonia)}</td>
          <td>${h.codigo_postal ? escapeHtml(h.codigo_postal) : '—'}</td>
          <td>${h.ocupacion_actual}/${h.capacidad}</td>
          <td><span class="admin-estado-badge ${estatus}">${estatusLabel(estatus)}</span></td>
          <td class="admin-td-comentarios">${comentariosCelda(h)}</td>
          <td>${ubicacionCelda(h)}</td>
          <td>
            <div class="admin-table-actions">
              <a class="admin-btn outline icon" title="Ver detalle" aria-label="Ver detalle" href="../hogar-detalle.html?id=${h.id}&from=admin-hogares">${EYE_ICON}</a>
              ${eliminarBtn}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Seguro que quieres eliminar el hogar de ${btn.dataset.nombre}? Esta acción no se puede deshacer.`)) {
        return;
      }
      btn.disabled = true;
      try {
        await eliminarHogar(session.token, btn.dataset.eliminar);
        await cargarHogares(document.getElementById('evento-select').value);
      } catch (err) {
        document.getElementById('hogares-error').textContent = err.message || 'No se pudo eliminar el hogar.';
        btn.disabled = false;
      }
    });
  });
}

async function cargarHogares(eventoId) {
  const errorEl = document.getElementById('hogares-error');
  errorEl.textContent = '';
  try {
    const { hogares } = await listarHogares(session.token, eventoId);
    document.getElementById('hogares-content').hidden = false;
    hogaresActuales = hogares;
    renderTabla();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = 'No se pudo cargar la lista de hogares de este evento.';
  }
}

try {
  const { user } = await me(session.token);
  if (user.role !== 'admin' && user.role !== 'supervisor') {
    window.location.href = '../eventos.html';
  }
  esAdmin = user.role === 'admin';
  if (!esAdmin) {
    document.getElementById('nav-usuarios').hidden = true;
    document.getElementById('nav-catalogos').hidden = true;
  }

  const { eventos: lista } = await listarEventos(session.token);
  eventos = lista;

  if (eventos.length === 0) {
    document.getElementById('hogares-empty').hidden = false;
  } else {
    poblarSelect();
    const activo = getActiveEventId();
    const inicial = eventos.find((e) => String(e.id) === activo) || eventos.find((e) => e.estatus === 'abierto') || eventos[0];
    document.getElementById('evento-select').value = inicial.id;
    setActiveEventId(inicial.id);
    await cargarHogares(inicial.id);
    suscribirEvento(inicial.id);
  }
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = '../index.html';
  } else {
    document.getElementById('hogares-error').textContent = 'No se pudo cargar la información de hogares.';
  }
}
