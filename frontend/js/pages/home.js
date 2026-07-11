import { registerServiceWorker } from '../app.js';
import { me } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';

registerServiceWorker();

const session = getSession();

if (!session) {
  window.location.href = 'index.html';
} else {
  try {
    const { user } = await me(session.token);
    document.getElementById('home-email').textContent = `${user.email} · ${user.role}`;

    if (user.role === 'agente' || user.role === 'admin') {
      const registrarBtn = document.getElementById('registrar-btn');
      registrarBtn.hidden = false;
      registrarBtn.addEventListener('click', () => {
        window.location.href = 'registro.html';
      });
    }
  } catch {
    clearSession();
    window.location.href = 'index.html';
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}
