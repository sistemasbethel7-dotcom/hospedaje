import { me, listarUsuarios, crearUsuario, actualizarUsuario, reenviarInvitacion, eliminarUsuario, listarEventos } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';
import { cerrarAlClicFuera } from '../domUtils.js';

const EDIT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2.121 2.121 0 00-3-3L5 17v3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 6.5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const TRASH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ROL_LABEL = { agente: 'Agente', supervisor: 'Supervisor', admin: 'Admin' };

let session = null;
let usuarioActualId = null;
let todosLosEventos = [];
let usuariosActuales = [];

function renderEventosChecklist(container, eventosSeleccionados) {
  if (todosLosEventos.length === 0) {
    container.innerHTML = '<p class="eventos-checklist-empty">No hay eventos creados todavía.</p>';
    return;
  }
  container.innerHTML = todosLosEventos
    .map(
      (e) => `
        <div class="toggle-row">
          <label class="toggle">
            <span class="toggle-label">${escapeHtml(e.nombre)}${e.sede ? ` — ${escapeHtml(e.sede)}` : ''}</span>
            <input type="checkbox" data-evento-id="${e.id}" ${eventosSeleccionados.includes(e.id) ? 'checked' : ''}>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
      `
    )
    .join('');
}

function leerEventosChecklist(container) {
  return Array.from(container.querySelectorAll('input[data-evento-id]:checked')).map((el) => Number(el.dataset.eventoId));
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatFecha(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function usuariosFiltrados() {
  const filtroNombre = document.getElementById('filtro-nombre').value.trim().toLowerCase();
  const filtroCorreo = document.getElementById('filtro-correo').value.trim().toLowerCase();
  const filtroTelefono = document.getElementById('filtro-telefono').value.trim().toLowerCase();
  const filtroRol = document.getElementById('filtro-rol').value;
  const filtroEventos = document.getElementById('filtro-eventos').value.trim().toLowerCase();
  const filtroEstatus = document.getElementById('filtro-estatus').value;
  const filtroDesde = document.getElementById('filtro-creado-desde').value;
  const filtroHasta = document.getElementById('filtro-creado-hasta').value;

  return usuariosActuales.filter((u) => {
    if (filtroNombre && !(u.nombre || '').toLowerCase().includes(filtroNombre)) return false;
    if (filtroCorreo && !u.email.toLowerCase().includes(filtroCorreo)) return false;
    if (filtroTelefono && !(u.telefono || '').toLowerCase().includes(filtroTelefono)) return false;
    if (filtroRol && u.role !== filtroRol) return false;
    if (filtroEventos) {
      const coincide = (u.eventos || []).some((e) => `${e.nombre} ${e.sede || ''}`.toLowerCase().includes(filtroEventos));
      if (!coincide) return false;
    }
    if (filtroEstatus === 'activo' && !u.activo) return false;
    if (filtroEstatus === 'inactivo' && u.activo) return false;
    if (filtroEstatus === 'pendiente' && !u.pendiente) return false;
    const fechaCreado = u.created_at.slice(0, 10);
    if (filtroDesde && fechaCreado < filtroDesde) return false;
    if (filtroHasta && fechaCreado > filtroHasta) return false;
    return true;
  });
}

function renderFiltrados() {
  const usuarios = usuariosFiltrados();
  const total = usuariosActuales.length;
  const contador = document.getElementById('usuarios-contador');
  const palabra = total === 1 ? 'usuario' : 'usuarios';
  contador.textContent = usuarios.length === total ? `${total} ${palabra}` : `${usuarios.length} de ${total} ${palabra}`;

  const wrap = document.getElementById('usuarios-table-wrap');
  const sinResultados = document.getElementById('usuarios-sin-resultados');
  if (usuarios.length === 0) {
    wrap.hidden = true;
    sinResultados.hidden = false;
    document.getElementById('usuarios-tbody').innerHTML = '';
    return;
  }
  wrap.hidden = false;
  sinResultados.hidden = true;

  renderUsuarios(usuarios);
}

function renderUsuarios(usuarios) {
  const tbody = document.getElementById('usuarios-tbody');
  tbody.innerHTML = usuarios
    .map((u) => {
      const isSelf = u.id === usuarioActualId;
      const botonEliminar = isSelf
        ? ''
        : `<button type="button" class="admin-btn danger icon" title="Eliminar" aria-label="Eliminar" data-eliminar="${u.id}" data-email="${escapeHtml(u.email)}">${TRASH_ICON}</button>`;

      const celdaEventos =
        u.role === 'agente'
          ? `
            <div class="eventos-chips">
              ${
                u.eventos.length > 0
                  ? u.eventos.map((e) => `<span class="eventos-chip">${escapeHtml(e.nombre)}${e.sede ? ` — ${escapeHtml(e.sede)}` : ''}</span>`).join('')
                  : '<span class="eventos-chip">Sin eventos asignados</span>'
              }
            </div>
          `
          : '—';

      return `
        <tr>
          <td>${escapeHtml(u.nombre || '—')}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.telefono || '—')}</td>
          <td>${ROL_LABEL[u.role] || u.role}</td>
          <td>${celdaEventos}</td>
          <td>
            <div class="admin-table-actions">
              <span class="estatus-badge ${u.activo ? '' : 'finalizado'}">${u.activo ? 'Activo' : 'Inactivo'}</span>
              ${u.pendiente ? '<span class="estatus-badge finalizado">Pendiente</span>' : ''}
            </div>
          </td>
          <td>${formatFecha(u.created_at)}</td>
          <td>
            <div class="admin-table-actions">
              <button type="button" class="admin-btn outline icon" title="Editar" aria-label="Editar" data-editar="${u.id}">${EDIT_ICON}</button>
              ${botonEliminar}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const usuario = usuarios.find((u) => u.id === Number(btn.dataset.editar));
      if (usuario) abrirModalEditar(usuario);
    });
  });

  tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmar = confirm(`¿Eliminar al usuario ${btn.dataset.email}? Esta acción no se puede deshacer.`);
      if (!confirmar) return;
      btn.disabled = true;
      try {
        await eliminarUsuario(session.token, btn.dataset.eliminar);
        await cargarUsuarios();
      } catch (err) {
        document.getElementById('usuarios-error').textContent = err.message || 'No se pudo eliminar el usuario.';
        btn.disabled = false;
      }
    });
  });
}

function setActivoToggle(activo) {
  const toggle = document.getElementById('um-activo-toggle');
  toggle.classList.toggle('on', activo);
  toggle.dataset.activo = String(activo);
  document.getElementById('um-activo-label').textContent = activo ? 'Activo' : 'Inactivo';
}

function actualizarVisibilidadEventosModal() {
  document.getElementById('um-eventos-field').hidden = document.getElementById('um-role').value !== 'agente';
}

function abrirModalEditar(usuario) {
  const isSelf = usuario.id === usuarioActualId;

  document.getElementById('usuario-modal-error').textContent = '';
  document.getElementById('um-correo').textContent = usuario.email;
  document.getElementById('um-nombre').value = usuario.nombre || '';
  document.getElementById('um-telefono').value = usuario.telefono || '';

  const roleSelect = document.getElementById('um-role');
  roleSelect.value = usuario.role;
  roleSelect.disabled = isSelf;

  setActivoToggle(usuario.activo);
  document.getElementById('um-activo-toggle').disabled = isSelf;

  renderEventosChecklist(document.getElementById('um-eventos-checklist'), (usuario.eventos || []).map((e) => e.id));
  actualizarVisibilidadEventosModal();

  document.getElementById('um-reenviar-section').hidden = !usuario.pendiente;
  document.getElementById('um-password-section').hidden = usuario.pendiente;
  document.getElementById('um-password').value = '';

  const reenviarBtn = document.getElementById('um-reenviar-btn');
  reenviarBtn.disabled = false;
  reenviarBtn.onclick = async () => {
    reenviarBtn.disabled = true;
    try {
      await reenviarInvitacion(session.token, usuario.id);
      alert(`Invitación reenviada a ${usuario.email}.`);
    } catch (err) {
      document.getElementById('usuario-modal-error').textContent = err.message || 'No se pudo reenviar la invitación.';
    } finally {
      reenviarBtn.disabled = false;
    }
  };

  const passwordBtn = document.getElementById('um-password-btn');
  passwordBtn.onclick = async () => {
    const errorEl = document.getElementById('usuario-modal-error');
    const nueva = document.getElementById('um-password').value;
    if (nueva.length < 6) {
      errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    passwordBtn.disabled = true;
    try {
      await actualizarUsuario(session.token, usuario.id, { password: nueva });
      document.getElementById('um-password').value = '';
      alert('Contraseña actualizada.');
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo cambiar la contraseña.';
    } finally {
      passwordBtn.disabled = false;
    }
  };

  const guardarBtn = document.getElementById('usuario-modal-guardar-btn');
  guardarBtn.onclick = async () => {
    const errorEl = document.getElementById('usuario-modal-error');
    errorEl.textContent = '';

    const nombre = document.getElementById('um-nombre').value.trim();
    const telefono = document.getElementById('um-telefono').value.trim();
    const role = roleSelect.value;
    const activo = document.getElementById('um-activo-toggle').dataset.activo === 'true';
    const eventosIds = role === 'agente' ? leerEventosChecklist(document.getElementById('um-eventos-checklist')) : undefined;

    if (role === 'agente' && eventosIds.length === 0) {
      errorEl.textContent = 'Selecciona al menos un evento para este agente.';
      return;
    }

    guardarBtn.disabled = true;
    try {
      await actualizarUsuario(session.token, usuario.id, {
        nombre,
        telefono,
        role: isSelf ? undefined : role,
        activo: isSelf ? undefined : activo,
        eventos_ids: eventosIds,
      });
      document.getElementById('usuario-modal-backdrop').hidden = true;
      await cargarUsuarios();
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo guardar.';
    } finally {
      guardarBtn.disabled = false;
    }
  };

  document.getElementById('usuario-modal-backdrop').hidden = false;
}

async function cargarUsuarios() {
  const errorEl = document.getElementById('usuarios-error');
  errorEl.textContent = '';
  try {
    const { usuarios } = await listarUsuarios(session.token);
    usuariosActuales = usuarios;
    renderFiltrados();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    errorEl.textContent = 'No se pudo cargar la lista de usuarios.';
  }
}

export async function mount({ navigate }) {
  session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }
  usuarioActualId = null;

  document.getElementById('mostrar-form-btn').addEventListener('click', () => {
    const form = document.getElementById('usuario-form');
    form.hidden = !form.hidden;
  });

  ['filtro-nombre', 'filtro-correo', 'filtro-telefono', 'filtro-eventos'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderFiltrados);
  });
  ['filtro-rol', 'filtro-estatus', 'filtro-creado-desde', 'filtro-creado-hasta'].forEach((id) => {
    document.getElementById(id).addEventListener('change', renderFiltrados);
  });

  const nuevoEventosField = document.getElementById('nuevo-eventos-field');
  const nuevoRoleSelect = document.getElementById('nuevo-role');
  const actualizarVisibilidadEventosCrear = () => {
    nuevoEventosField.hidden = nuevoRoleSelect.value !== 'agente';
  };
  nuevoRoleSelect.addEventListener('change', actualizarVisibilidadEventosCrear);
  actualizarVisibilidadEventosCrear();

  document.getElementById('um-role').addEventListener('change', actualizarVisibilidadEventosModal);
  document.getElementById('um-activo-toggle').addEventListener('click', (event) => {
    if (event.currentTarget.disabled) return;
    setActivoToggle(event.currentTarget.dataset.activo !== 'true');
  });

  const usuarioModalBackdrop = document.getElementById('usuario-modal-backdrop');
  const cerrarModalUsuario = () => {
    usuarioModalBackdrop.hidden = true;
  };
  document.getElementById('usuario-modal-close').addEventListener('click', cerrarModalUsuario);
  cerrarAlClicFuera(usuarioModalBackdrop, cerrarModalUsuario);

  document.getElementById('guardar-usuario-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('usuarios-error');
    errorEl.textContent = '';

    const nombre = document.getElementById('nuevo-nombre').value.trim();
    const email = document.getElementById('nuevo-email').value.trim();
    const telefono = document.getElementById('nuevo-telefono').value.trim();
    const role = nuevoRoleSelect.value;
    const eventosIds =
      role === 'agente' ? leerEventosChecklist(document.getElementById('nuevo-eventos-checklist')) : undefined;

    if (!email) {
      errorEl.textContent = 'Completa el correo.';
      return;
    }
    if (role === 'agente' && eventosIds.length === 0) {
      errorEl.textContent = 'Selecciona al menos un evento para este agente.';
      return;
    }

    const btn = document.getElementById('guardar-usuario-btn');
    btn.disabled = true;
    try {
      const { avisoCorreo } = await crearUsuario(session.token, {
        email,
        role,
        nombre: nombre || undefined,
        telefono: telefono || undefined,
        eventos_ids: eventosIds,
      });
      document.getElementById('nuevo-nombre').value = '';
      document.getElementById('nuevo-email').value = '';
      document.getElementById('nuevo-telefono').value = '';
      document.getElementById('usuario-form').hidden = true;
      if (avisoCorreo) errorEl.textContent = avisoCorreo;
      await cargarUsuarios();
    } catch (err) {
      errorEl.textContent = err.message || 'No se pudo crear el usuario.';
    } finally {
      btn.disabled = false;
    }
  });

  try {
    const { user } = await me(session.token);
    if (user.role !== 'admin') {
      if (user.role === 'supervisor') navigate('dashboard.html');
      else window.location.href = '../eventos.html';
      return;
    }
    usuarioActualId = user.id;
    const { eventos } = await listarEventos(session.token);
    todosLosEventos = eventos;
    renderEventosChecklist(document.getElementById('nuevo-eventos-checklist'), []);
    await cargarUsuarios();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
    } else {
      document.getElementById('usuarios-error').textContent = 'No se pudo cargar la información de sesión.';
    }
  }
}
