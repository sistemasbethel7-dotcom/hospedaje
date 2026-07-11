import { registerServiceWorker } from '../app.js';
import { me } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';

registerServiceWorker();

const session = getSession();

function displayName(email) {
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

if (!session) {
  window.location.href = 'index.html';
} else {
  try {
    const { user } = await me(session.token);
    document.getElementById('home-role').textContent = user.role;
    document.getElementById('home-greeting-name').textContent = `Hola, ${displayName(user.email)}`;

    if (user.role === 'agente' || user.role === 'admin') {
      const quickActions = document.getElementById('quick-actions');
      quickActions.hidden = false;

      document.getElementById('qa-hogar').addEventListener('click', () => {
        window.location.href = 'registro.html';
      });
      document.getElementById('qa-ingresos').addEventListener('click', () => {
        window.location.href = 'ingresos.html';
      });
    }

    document.getElementById('menu-hogares').addEventListener('click', () => {
      window.location.href = 'hogares.html';
    });
  } catch {
    clearSession();
    window.location.href = 'index.html';
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}
