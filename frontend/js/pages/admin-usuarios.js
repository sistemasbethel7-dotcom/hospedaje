import { registerServiceWorker } from '../app.js';
import { me, listarUsuarios, crearUsuario, actualizarUsuario, reenviarInvitacion, eliminarUsuario } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = '../index.html';
}

let usuarioActualId = null;

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  clearActiveEventId();
  window.location.href = '../index.html';
});

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
        ? `<button type="button" class="admin-btn outline" data-reenviar="${u.id}" data-email="${escapeHtml(u.email)}">Reenviar invitación</button>`
        : `<button type="button" class="admin-btn outline" data-reset="${u.id}" data-email="${escapeHtml(u.email)}">Restablecer contraseña</button>`;

      const botonEliminar = isSelf
        ? ''
        : `<button type="button" class="admin-btn outline danger" data-eliminar="${u.id}" data-email="${escapeHtml(u.email)}">Eliminar</button>`;

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

try {
  const { user } = await me(session.token);
  if (user.role !== 'admin') {
    window.location.href = user.role === 'supervisor' ? 'dashboard.html' : '../eventos.html';
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
