import { registerServiceWorker } from './app.js';
import { getSession, clearSession } from './services/session.js';
import { clearActiveEventId } from './services/eventoActivo.js';
import { setupAgentPanel } from './agentPanel.js';
import { initRouter, navigate, getCurrentModule } from './router.js';

let shellPromise = null;

function wireLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearSession();
    clearActiveEventId();
    window.location.href = '../index.html';
  });
}

// Si la página que ya está montada sabe mostrar un hogar en el sitio (Dashboard
// y Hogares exportan `abrirHogar`), lo hace directo sin salir de donde está.
// Si no, navega (vía SPA) a Hogares con el hogar pedido.
function abrirHogarEnSitio(id) {
  const modulo = getCurrentModule();
  if (modulo?.abrirHogar) {
    modulo.abrirHogar(id);
    return;
  }
  navigate(`hogares.html?ver=${id}`);
}

async function doMountShell() {
  registerServiceWorker();

  const session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return new Promise(() => {});
  }

  wireLogout();
  setupAgentPanel({ onAbrirHogar: abrirHogarEnSitio });
  initRouter();

  return { session };
}

export function mountShellOnce() {
  return (shellPromise ??= doMountShell());
}
