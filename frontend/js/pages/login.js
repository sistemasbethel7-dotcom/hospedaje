import { registerServiceWorker } from '../app.js';
import { login } from '../services/api.js';
import { saveSession, getSession } from '../services/session.js';
import { getActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

function destinoPostLogin(role) {
  if (role === 'admin' || role === 'supervisor') {
    return 'admin/dashboard.html';
  }
  return getActiveEventId() ? 'home.html' : 'eventos.html';
}

const sesionExistente = getSession();
if (sesionExistente) {
  window.location.href = destinoPostLogin(sesionExistente.user.role);
}

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    errorEl.textContent = 'Completa tu correo y contraseña.';
    return;
  }

  submitBtn.disabled = true;
  try {
    const session = await login(email, password);
    saveSession(session);
    window.location.href = destinoPostLogin(session.user.role);
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
