import { registerServiceWorker } from '../app.js';
import { getSession, clearSession } from '../services/session.js';

registerServiceWorker();

const session = getSession();

if (!session) {
  window.location.href = 'index.html';
} else {
  document.getElementById('home-email').textContent = session.user.email;

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}
