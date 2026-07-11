import { registerServiceWorker } from '../app.js';
import { me, obtenerEvento } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';

registerServiceWorker();

const session = getSession();

function formatFecha(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

document.getElementById('cambiar-evento-btn').addEventListener('click', () => {
  window.location.href = 'eventos.html';
});

document.getElementById('menu-hogares').addEventListener('click', () => {
  window.location.href = 'hogares.html';
});

document.getElementById('qa-hogar').addEventListener('click', () => {
  window.location.href = 'registro.html';
});
document.getElementById('qa-ingresos').addEventListener('click', () => {
  window.location.href = 'ingresos.html';
});
document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  clearActiveEventId();
  window.location.href = 'index.html';
});

if (!session) {
  window.location.href = 'index.html';
} else {
  const eventoId = getActiveEventId();
  if (!eventoId) {
    window.location.href = 'eventos.html';
  } else {
    try {
      const [{ user }, { evento }] = await Promise.all([me(session.token), obtenerEvento(session.token, eventoId)]);

      document.getElementById('home-role').textContent = user.role;

      const eventoBox = document.getElementById('home-evento');
      eventoBox.hidden = false;
      document.getElementById('evento-nombre').textContent = evento.nombre;
      document.getElementById('evento-fechas').textContent = `${formatFecha(evento.fecha_inicio)} – ${formatFecha(evento.fecha_fin)}`;

      const esGestor = user.role === 'admin' || user.role === 'supervisor';
      if (esGestor) {
        document.getElementById('evento-stats').hidden = false;
        document.getElementById('evento-stat-hogares').textContent = evento.total_hogares;
        document.getElementById('evento-stat-ocupacion').textContent = `${evento.ocupacion_total}/${evento.capacidad_total}`;
        document.getElementById('volver-dashboard-link').hidden = false;
      }

      const eventoAbierto = evento.estatus === 'abierto';
      if ((user.role === 'agente' || user.role === 'admin') && eventoAbierto) {
        document.getElementById('qa-hogar').hidden = false;
        document.getElementById('qa-ingresos').hidden = false;
      }
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        clearActiveEventId();
        window.location.href = 'index.html';
      } else if (err.status === 404) {
        clearActiveEventId();
        window.location.href = 'eventos.html';
      } else {
        clearSession();
        window.location.href = 'index.html';
      }
    }
  }
}
