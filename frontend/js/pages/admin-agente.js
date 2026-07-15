import { me, obtenerConfigAgente, actualizarConfigAgente } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';

let session = null;
let onSubmit = null;

function llenarFormulario(config) {
  document.getElementById('agente-habilitado-check').checked = config.habilitado;
  document.getElementById('agente-voz-select').value = config.voz;
  document.getElementById('agente-acento-input').value = config.acento_estilo;
}

async function guardar(event) {
  event.preventDefault();
  const errorEl = document.getElementById('agente-error');
  const exitoEl = document.getElementById('agente-exito');
  errorEl.textContent = '';
  exitoEl.hidden = true;

  const payload = {
    habilitado: document.getElementById('agente-habilitado-check').checked,
    voz: document.getElementById('agente-voz-select').value,
    acento_estilo: document.getElementById('agente-acento-input').value,
  };

  try {
    const { config } = await actualizarConfigAgente(session.token, payload);
    llenarFormulario(config);
    exitoEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

export async function mount() {
  session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  onSubmit = guardar;
  document.getElementById('agente-form').addEventListener('submit', onSubmit);

  try {
    const { user } = await me(session.token);
    if (user.role !== 'admin') {
      return { redirectTo: 'dashboard.html' };
    }

    const { config } = await obtenerConfigAgente(session.token);
    llenarFormulario(config);
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = '../index.html';
    } else {
      document.getElementById('agente-error').textContent = 'No se pudo cargar la configuración del agente.';
    }
  }
}

export function unmount() {
  document.getElementById('agente-form')?.removeEventListener('submit', onSubmit);
  onSubmit = null;
}
