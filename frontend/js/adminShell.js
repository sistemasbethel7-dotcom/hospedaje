import { registerServiceWorker } from './app.js';
import { getSession, clearSession } from './services/session.js';
import { clearActiveEventId } from './services/eventoActivo.js';
import { setupAgentPanel } from './agentPanel.js';
import { initRouter, navigate } from './router.js';

let shellPromise = null;

function wireLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearSession();
    clearActiveEventId();
    window.location.href = '../index.html';
  });
}

async function doMountShell() {
  registerServiceWorker();

  const session = getSession();
  if (!session) {
    window.location.href = '../index.html';
    return new Promise(() => {});
  }

  wireLogout();
  setupAgentPanel({ onNavegarPagina: (url) => navigate(url) });
  initRouter();

  return { session };
}

export function mountShellOnce() {
  return (shellPromise ??= doMountShell());
}
