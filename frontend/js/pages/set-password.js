import { registerServiceWorker } from '../app.js';
import { validarTokenInvitacion, establecerPassword } from '../services/api.js';
import { saveSession } from '../services/session.js';
import { getActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

function destinoPostLogin(role) {
  if (role === 'admin' || role === 'supervisor') {
    return 'admin/dashboard.html';
  }
  return getActiveEventId() ? 'home.html' : 'eventos.html';
}

const params = new URLSearchParams(window.location.search);
const token = params.get('token');

const form = document.getElementById('set-password-form');
const emailEl = document.getElementById('set-password-email');
const invalidEl = document.getElementById('set-password-invalid');
const errorEl = document.getElementById('set-password-error');
const submitBtn = document.getElementById('set-password-submit');

if (!token) {
  invalidEl.textContent = 'Este link no es válido. Pide al administrador que te reenvíe la invitación.';
  invalidEl.hidden = false;
} else {
  try {
    const { email } = await validarTokenInvitacion(token);
    emailEl.textContent = email;
    form.hidden = false;
  } catch (err) {
    invalidEl.textContent = err.message || 'Este link ya expiró. Pide al administrador que te reenvíe la invitación.';
    invalidEl.hidden = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const password = form.password.value;
  const passwordConfirm = form['password-confirm'].value;

  if (password.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  if (password !== passwordConfirm) {
    errorEl.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  submitBtn.disabled = true;
  try {
    const session = await establecerPassword(token, password);
    saveSession(session);
    window.location.href = destinoPostLogin(session.user.role);
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
