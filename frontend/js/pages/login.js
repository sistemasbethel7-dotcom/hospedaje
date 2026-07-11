import { registerServiceWorker } from '../app.js';
import { login } from '../services/api.js';

registerServiceWorker();

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const phone = form.phone.value.trim();
  const code = form.code.value.trim();

  if (!phone || !code) {
    errorEl.textContent = 'Completa tu teléfono y código de acceso.';
    return;
  }

  submitBtn.disabled = true;
  try {
    const session = await login(phone, code);
    sessionStorage.setItem('anfitriones_session', JSON.stringify(session));
    window.location.href = 'registro.html';
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
