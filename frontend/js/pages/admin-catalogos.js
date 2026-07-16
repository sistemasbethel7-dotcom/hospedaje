import { me, listarCatalogo, crearCatalogoItem, actualizarCatalogoItem, eliminarCatalogoItem } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';

const TIPOS = ['servicio', 'vulnerabilidad', 'perfil'];
const INPUT_POR_TIPO = { servicio: 'nuevo-servicio', vulnerabilidad: 'nueva-vulnerabilidad', perfil: 'nuevo-perfil' };

let session = null;

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderTipo(tipo, items) {
  const tbody = document.getElementById(`tbody-${tipo}`);
  tbody.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.etiqueta)}</td>
          <td>
            <div class="admin-table-actions">
              <button type="button" class="admin-toggle ${item.activo ? 'on' : ''}" data-toggle-activo="${item.id}" data-activo="${item.activo}" aria-label="Activo/Inactivo">
                <span class="admin-toggle-thumb"></span>
              </button>
              <span class="estatus-badge ${item.activo ? '' : 'finalizado'}">${item.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
          </td>
          <td>
            <button type="button" class="admin-btn danger" data-eliminar="${item.id}">Eliminar</button>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('[data-toggle-activo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const nuevoActivo = btn.dataset.activo !== 'true';
      try {
        await actualizarCatalogoItem(session.token, btn.dataset.toggleActivo, { activo: nuevoActivo });
        await cargarTipo(tipo);
      } catch (err) {
        document.getElementById('catalogos-error').textContent = err.message || 'No se pudo actualizar el estatus.';
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este elemento? Los registros ya guardados con esta etiqueta no cambian.')) return;
      btn.disabled = true;
      try {
        await eliminarCatalogoItem(session.token, btn.dataset.eliminar);
        await cargarTipo(tipo);
      } catch (err) {
        document.getElementById('catalogos-error').textContent = err.message || 'No se pudo eliminar el elemento.';
        btn.disabled = false;
      }
    });
  });
}

async function cargarTipo(tipo) {
  try {
    const { items } = await listarCatalogo(session.token, tipo);
    renderTipo(tipo, items);
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
      return;
    }
    document.getElementById('catalogos-error').textContent = 'No se pudo cargar el catálogo.';
  }
}

export async function mount({ navigate }) {
  session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  document.querySelectorAll('[data-tipo-agregar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tipo = btn.dataset.tipoAgregar;
      const input = document.getElementById(INPUT_POR_TIPO[tipo]);
      const etiqueta = input.value.trim();
      const errorEl = document.getElementById('catalogos-error');
      errorEl.textContent = '';

      if (!etiqueta) return;

      btn.disabled = true;
      try {
        await crearCatalogoItem(session.token, { tipo, etiqueta });
        input.value = '';
        await cargarTipo(tipo);
      } catch (err) {
        errorEl.textContent = err.message || 'No se pudo agregar el elemento.';
      } finally {
        btn.disabled = false;
      }
    });
  });

  try {
    const { user } = await me(session.token);
    if (user.role !== 'admin') {
      if (user.role === 'supervisor') navigate('dashboard.html');
      else window.location.href = '../eventos.html';
      return;
    }
    await Promise.all(TIPOS.map(cargarTipo));
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
    } else {
      document.getElementById('catalogos-error').textContent = 'No se pudo cargar la información de sesión.';
    }
  }
}
