import { registerServiceWorker } from '../app.js';
import { login } from '../services/api.js';
import { saveSession, getSession } from '../services/session.js';

registerServiceWorker();

if (getSession()) {
  window.location.href = 'home.html';
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
    window.location.href = 'home.html';
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
