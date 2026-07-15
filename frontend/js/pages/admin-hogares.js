import { me, listarEventos, listarHogares, eliminarHogar, obtenerHogar, actualizarHogar, obtenerCatalogosActivos } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, setActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';
import { subscribeToEvento } from '../services/eventStream.js';
import { setupMapModal } from '../mapModal.js';

const HOUSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
const TRASH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PENCIL_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 6.5l3 3" stroke="currentColor" stroke-width="1.8"/></svg>`;

let session = null;
let eventos = [];
let hogaresActuales = [];
let esAdmin = false;
let unsubscribeStream = null;
let refrescoPendiente = null;
let limpiarMapModal = null;

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
      const editarBtn = esAdmin
        ? `<button type="button" class="admin-btn outline icon" title="Editar" aria-label="Editar" data-editar="${h.id}">${PENCIL_ICON}</button>`
        : '';
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
              <button type="button" class="admin-btn outline icon" title="Ver" aria-label="Ver" data-ver="${h.id}">${EYE_ICON}</button>
              ${editarBtn}
              ${eliminarBtn}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-ver]').forEach((btn) => {
    btn.addEventListener('click', () => abrirEditar(btn.dataset.ver, true));
  });

  tbody.querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => abrirEditar(btn.dataset.editar));
  });

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

// ---- Modal de edición (escritorio) ----
// El PUT de hogares sobreescribe todos los campos, así que el modal siempre
// envía el registro completo (incluidos lat/lng y notas) para no borrar nada.

let catalogosEdit = null;
let hogarEditando = null;
const editState = { tenencia: null, servicios: [], vulnerabilidades: [], perfil: [], lat: null, lng: null };

function updateLocationTrigger() {
  const btn = document.getElementById('ubicar-btn');
  const text = document.getElementById('ubicar-trigger-text');
  const hasLocation = typeof editState.lat === 'number' && typeof editState.lng === 'number';
  btn.classList.toggle('set', hasLocation);
  text.textContent = hasLocation ? 'Ubicación fijada · Clic para ajustar' : 'Ubicar en el mapa';
}

function renderTenenciaEdit() {
  document.querySelectorAll('#e-tenencia-group .pill').forEach((pill) => {
    pill.classList.toggle('selected', editState.tenencia === pill.dataset.tenencia);
  });
}

function renderPillsEdit(containerId, items, key) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach((etiqueta) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill';
    pill.textContent = etiqueta;
    pill.classList.toggle('selected', editState[key].includes(etiqueta));
    pill.addEventListener('click', () => {
      const idx = editState[key].indexOf(etiqueta);
      if (idx >= 0) {
        editState[key].splice(idx, 1);
        pill.classList.remove('selected');
      } else {
        editState[key].push(etiqueta);
        pill.classList.add('selected');
      }
    });
    container.appendChild(pill);
  });
}

function cerrarEditar() {
  document.getElementById('editar-modal-backdrop').hidden = true;
  hogarEditando = null;
}

// soloLectura = modo "Ver": mismo modal, campos deshabilitados y sin Guardar.
async function abrirEditar(id, soloLectura = false) {
  const errorEl = document.getElementById('hogares-error');
  errorEl.textContent = '';
  try {
    if (!catalogosEdit) {
      const { catalogos } = await obtenerCatalogosActivos(session.token);
      catalogosEdit = catalogos;
    }
    const { hogar } = await obtenerHogar(session.token, id);
    hogarEditando = hogar;
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = 'No se pudo cargar el hogar para editar.';
    return;
  }

  document.getElementById('editar-modal-title').textContent =
    `${soloLectura ? 'Hogar' : 'Editar hogar'} · ${folioDe(hogarEditando.id)}`;
  document.getElementById('editar-form').classList.toggle('solo-lectura', soloLectura);
  ['e-nombre', 'e-telefono', 'e-calle', 'e-cp', 'e-colonia', 'e-estado', 'e-referencias', 'e-capacidad', 'e-notas', 'e-comentarios']
    .forEach((campo) => { document.getElementById(campo).disabled = soloLectura; });
  document.getElementById('editar-guardar').hidden = soloLectura;
  document.getElementById('editar-cancelar').textContent = soloLectura ? 'Cerrar' : 'Cancelar';
  document.getElementById('e-nombre').value = hogarEditando.nombre_dueno;
  document.getElementById('e-telefono').value = hogarEditando.telefono_dueno || '';
  document.getElementById('e-calle').value = hogarEditando.calle_numero;
  document.getElementById('e-cp').value = hogarEditando.codigo_postal || '';
  document.getElementById('e-colonia').value = hogarEditando.colonia;
  document.getElementById('e-estado').value = hogarEditando.estado || '';
  document.getElementById('e-referencias').value = hogarEditando.referencias || '';
  document.getElementById('e-capacidad').value = hogarEditando.capacidad;
  document.getElementById('e-notas').value = hogarEditando.notas_vulnerabilidad || '';
  document.getElementById('e-comentarios').value = hogarEditando.comentarios || '';

  editState.tenencia = hogarEditando.tenencia || null;
  editState.servicios = [...hogarEditando.servicios];
  editState.vulnerabilidades = [...hogarEditando.vulnerabilidades];
  editState.perfil = [...hogarEditando.perfil_sugerido];
  editState.lat = hogarEditando.lat;
  editState.lng = hogarEditando.lng;
  updateLocationTrigger();
  renderTenenciaEdit();
  renderPillsEdit('e-servicios-group', catalogosEdit.servicio, 'servicios');
  renderPillsEdit('e-vulnerabilidades-group', catalogosEdit.vulnerabilidad, 'vulnerabilidades');
  renderPillsEdit('e-perfil-group', catalogosEdit.perfil, 'perfil');

  document.getElementById('editar-error').textContent = '';
  document.getElementById('editar-modal-backdrop').hidden = false;
}

export function abrirHogar(id) {
  return abrirEditar(id, true);
}

async function guardarEdicion(event) {
  event.preventDefault();
  if (!hogarEditando) return;
  if (document.getElementById('editar-form').classList.contains('solo-lectura')) return;
  const errorEl = document.getElementById('editar-error');
  errorEl.textContent = '';

  const nombre = document.getElementById('e-nombre').value.trim();
  const calle = document.getElementById('e-calle').value.trim();
  const colonia = document.getElementById('e-colonia').value.trim();
  const estado = document.getElementById('e-estado').value.trim();
  const capacidad = parseInt(document.getElementById('e-capacidad').value, 10);
  if (!nombre || !calle || !colonia || !estado) {
    errorEl.textContent = 'Completa el nombre del dueño, la calle y número, la colonia y el estado.';
    return;
  }
  if (Number.isNaN(capacidad) || capacidad < 1 || capacidad > 500) {
    errorEl.textContent = 'La capacidad debe ser un número entre 1 y 500.';
    return;
  }

  const formData = new FormData();
  formData.append('nombre_dueno', nombre);
  formData.append('telefono_dueno', document.getElementById('e-telefono').value.trim());
  formData.append('calle_numero', calle);
  formData.append('colonia', colonia);
  formData.append('codigo_postal', document.getElementById('e-cp').value.trim());
  formData.append('estado', estado);
  formData.append('referencias', document.getElementById('e-referencias').value.trim());
  if (editState.lat != null) formData.append('lat', editState.lat);
  if (editState.lng != null) formData.append('lng', editState.lng);
  formData.append('capacidad', capacidad);
  formData.append('tenencia', editState.tenencia || '');
  formData.append('comentarios', document.getElementById('e-comentarios').value.trim());
  formData.append('servicios', JSON.stringify(editState.servicios));
  formData.append('vulnerabilidades', JSON.stringify(editState.vulnerabilidades));
  formData.append('notas_vulnerabilidad', document.getElementById('e-notas').value.trim());
  formData.append('perfil_sugerido', JSON.stringify(editState.perfil));

  const guardarBtn = document.getElementById('editar-guardar');
  guardarBtn.disabled = true;
  try {
    await actualizarHogar(session.token, hogarEditando.id, formData);
    cerrarEditar();
    await cargarHogares(document.getElementById('evento-select').value);
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = err.message || 'No se pudo guardar el hogar.';
  } finally {
    guardarBtn.disabled = false;
  }
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

export async function mount() {
  session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  eventos = [];
  hogaresActuales = [];
  esAdmin = false;
  catalogosEdit = null;
  hogarEditando = null;

  document.getElementById('evento-select').addEventListener('change', (event) => {
    setActiveEventId(event.target.value);
    cargarHogares(event.target.value);
    suscribirEvento(event.target.value);
  });

  ['filtro-dueno', 'filtro-colonia', 'filtro-calle', 'filtro-cp'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderTabla);
  });

  document.querySelectorAll('#e-tenencia-group .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      editState.tenencia = editState.tenencia === pill.dataset.tenencia ? null : pill.dataset.tenencia;
      renderTenenciaEdit();
    });
  });

  limpiarMapModal = setupMapModal({
    getLocation: () =>
      (typeof editState.lat === 'number' && typeof editState.lng === 'number' ? { lat: editState.lat, lng: editState.lng } : null),
    onConfirm: (lat, lng) => {
      editState.lat = lat;
      editState.lng = lng;
      updateLocationTrigger();
    },
  });
  document.getElementById('editar-form').addEventListener('submit', guardarEdicion);
  document.getElementById('editar-cancelar').addEventListener('click', cerrarEditar);
  document.getElementById('editar-modal-close').addEventListener('click', cerrarEditar);
  document.getElementById('editar-modal-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) cerrarEditar();
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

      const verId = new URLSearchParams(window.location.search).get('ver');
      if (verId) abrirEditar(Number(verId), true);
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
}

export function unmount() {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  clearTimeout(refrescoPendiente);
  limpiarMapModal?.();
  limpiarMapModal = null;
}
