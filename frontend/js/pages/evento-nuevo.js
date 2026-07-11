import { registerServiceWorker } from '../app.js';
import { me, crearEvento } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'eventos.html';
});

try {
  const { user } = await me(session.token);
  if (user.role !== 'admin') {
    window.location.href = 'eventos.html';
  }
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
  }
  window.location.href = 'index.html';
}

document.getElementById('crear-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('evento-error');
  errorEl.textContent = '';

  const nombre = document.getElementById('nombre').value.trim();
  const sede = document.getElementById('sede').value.trim();
  const fechaInicio = document.getElementById('fecha_inicio').value;
  const fechaFin = document.getElementById('fecha_fin').value;

  if (!nombre || !fechaInicio || !fechaFin) {
    errorEl.textContent = 'Completa el nombre y las fechas del evento.';
    return;
  }
  if (fechaFin < fechaInicio) {
    errorEl.textContent = 'La fecha de fin no puede ser anterior a la de inicio.';
    return;
  }

  const btn = document.getElementById('crear-btn');
  btn.disabled = true;
  try {
    await crearEvento(session.token, {
      nombre,
      sede: sede || null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    });
    window.location.href = 'eventos.html';
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudo crear el evento.';
  } finally {
    btn.disabled = false;
  }
});
