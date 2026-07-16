import { me, listarUsuarios, crearUsuario, actualizarUsuario, reenviarInvitacion, eliminarUsuario } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';

const MAIL_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const KEY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 7.5V7.5C16.3255 6.17452 18.4745 6.17452 19.8 7.5V7.5C21.1255 8.82548 21.1255 10.9745 19.8 12.3V12.3C18.4745 13.6255 16.3255 13.6255 15 12.3L4.24264 23.0574C3.8675 23.4325 3.35876 23.6432 2.82843 23.6432H2V22.8148C2 22.2845 2.21071 21.7757 2.58579 21.4007L15 8.98642M15 7.5L15 8.98642M15 7.5L11 11.5M15 8.98642L11.5 12.4864M18.5 9.5C18.5 10.0523 18.0523 10.5 17.5 10.5C16.9477 10.5 16.5 10.0523 16.5 9.5C16.5 8.94772 16.9477 8.5 17.5 8.5C18.0523 8.5 18.5 8.94772 18.5 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const TRASH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let session = null;
let usuarioActualId = null;

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatFecha(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function renderUsuarios(usuarios) {
  const tbody = document.getElementById('usuarios-tbody');
  tbody.innerHTML = usuarios
    .map((u) => {
      const isSelf = u.id === usuarioActualId;
      const accionPendiente = u.pendiente
        ? `<button type="button" class="admin-btn outline icon" title="Reenviar invitación" aria-label="Reenviar invitación" data-reenviar="${u.id}" data-email="${escapeHtml(u.email)}">${MAIL_ICON}</button>`
        : `<button type="button" class="admin-btn outline icon" title="Restablecer contraseña" aria-label="Restablecer contraseña" data-reset="${u.id}" data-email="${escapeHtml(u.email)}">${KEY_ICON}</button>`;

      const botonEliminar = isSelf
        ? ''
        : `<button type="button" class="admin-btn danger icon" title="Eliminar" aria-label="Eliminar" data-eliminar="${u.id}" data-email="${escapeHtml(u.email)}">${TRASH_ICON}</button>`;

      return `
        <tr>
          <td>${escapeHtml(u.nombre || '—')}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.telefono || '—')}</td>
          <td>
            <select class="admin-select" data-role-select="${u.id}" ${isSelf ? 'disabled' : ''}>
              <option value="agente" ${u.role === 'agente' ? 'selected' : ''}>Agente</option>
              <option value="supervisor" ${u.role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>
            <div class="admin-table-actions">
              <button type="button" class="admin-toggle ${u.activo ? 'on' : ''}" data-toggle-activo="${u.id}" data-activo="${u.activo}" ${isSelf ? 'disabled' : ''} aria-label="Activo/Inactivo">
                <span class="admin-toggle-thumb"></span>
              </button>
              <span class="estatus-badge ${u.activo ? '' : 'finalizado'}">${u.activo ? 'Activo' : 'Inactivo'}</span>
              ${u.pendiente ? '<span class="estatus-badge finalizado">Pendiente</span>' : ''}
            </div>
          </td>
          <td>${formatFecha(u.created_at)}</td>
          <td>
            <div class="admin-table-actions">
              ${accionPendiente}
              ${botonEliminar}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-role-select]').forEach((select) => {
    select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        await actualizarUsuario(session.token, select.dataset.roleSelect, { role: select.value });
        await cargarUsuarios();
      } catch (err) {
        document.getElementById('usuarios-error').textContent = err.message || 'No se pudo cambiar el rol.';
        select.disabled = false;
      }
    });
  });

  tbody.querySelectorAll('[data-toggle-activo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const nuevoActivo = btn.dataset.activo !== 'true';
      try {
        await actualizarUsuario(session.token, btn.dataset.toggleActivo, { activo: nuevoActivo });
        await cargarUsuarios();
      } catch (err) {
        document.getElementById('usuarios-error').textContent = err.message || 'No se pudo actualizar el estatus.';
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll('[data-reenviar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await reenviarInvitacion(session.token, btn.dataset.reenviar);
        alert(`Invitación reenviada a ${btn.dataset.email}.`);
      } catch (err) {
        document.getElementById('usuarios-error').textContent = err.message || 'No se pudo reenviar la invitación.';
      } finally {
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nueva = prompt(`Nueva contraseña para ${btn.dataset.email}:`);
      if (!nueva) return;
      if (nueva.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      btn.disabled = true;
      try {
        await actualizarUsuario(session.token, btn.dataset.reset, { password: nueva });
        alert('Contraseña actualizada.');
      } catch (err) {
        document.getElementById('usuarios-error').textContent = err.message || 'No se pudo restablecer la contraseña.';
      } finally {
        btn.disabled = false;
      }
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

async function cargarUsuarios() {
  const errorEl = document.getElementById('usuarios-error');
  errorEl.textContent = '';
  try {
    const { usuarios } = await listarUsuarios(session.token);
    renderUsuarios(usuarios);
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

  document.getElementById('guardar-usuario-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('usuarios-error');
    errorEl.textContent = '';

    const nombre = document.getElementById('nuevo-nombre').value.trim();
    const email = document.getElementById('nuevo-email').value.trim();
    const telefono = document.getElementById('nuevo-telefono').value.trim();
    const role = document.getElementById('nuevo-role').value;

    if (!email) {
      errorEl.textContent = 'Completa el correo.';
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
