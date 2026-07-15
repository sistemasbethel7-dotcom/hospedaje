const RUTAS = {
  '/admin/dashboard.html': './pages/admin-dashboard.js',
  '/admin/hogares.html': './pages/admin-hogares.js',
  '/admin/agente.html': './pages/admin-agente.js',
};

let currentModule = null;
let currentPath = null;
let navToken = 0;
let iniciado = false;

export function getCurrentModule() {
  return currentModule;
}

export async function navigate(url, { isPopstate = false } = {}) {
  const destino = new URL(url, window.location.href);
  const path = destino.pathname;

  if (path === currentPath) {
    if (!isPopstate) history.pushState({}, '', destino);
    return;
  }

  if (!RUTAS[path]) {
    console.warn('[router] ruta no registrada, navegación real:', path);
    window.location.href = url;
    return;
  }

  const miToken = ++navToken;

  try {
    await currentModule?.unmount?.();
  } catch (err) {
    console.error('Error al desmontar la página anterior', err);
  }

  let html;
  try {
    const res = await fetch(destino, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Respuesta no OK: ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn('[router] fetch de la página falló, navegación real:', err);
    window.location.href = url;
    return;
  }

  if (miToken !== navToken) return;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nuevoMain = doc.querySelector('.admin-main');
  const mainActual = document.querySelector('.admin-main');
  if (!nuevoMain || !mainActual) {
    console.warn('[router] no se encontró .admin-main, navegación real');
    window.location.href = url;
    return;
  }

  const estiloNuevo = nuevoMain.getAttribute('style');
  if (estiloNuevo) mainActual.setAttribute('style', estiloNuevo);
  else mainActual.removeAttribute('style');
  mainActual.replaceChildren(...nuevoMain.childNodes);
  document.title = doc.title;

  document.querySelectorAll('.admin-nav-link').forEach((link) => {
    let esActivo = false;
    try {
      esActivo = new URL(link.href, window.location.href).pathname === path;
    } catch {
      esActivo = false;
    }
    link.classList.toggle('active', esActivo);
  });

  if (!isPopstate) history.pushState({}, '', destino);
  currentPath = path;

  try {
    const modulo = await import(RUTAS[path]);
    if (miToken !== navToken) return;
    currentModule = modulo;
    const resultado = await modulo.mount?.({ navigate });
    if (resultado?.redirectTo) {
      navigate(resultado.redirectTo);
    }
  } catch (err) {
    console.error('Error al montar la página', err);
    mainActual.innerHTML = `<p class="admin-error">No se pudo cargar la página. <a href="${url}">Intenta de nuevo</a>.</p>`;
  }
}

function alClicSidebar(event) {
  const link = event.target.closest('a');
  if (!link) return;
  if (link.target || link.hasAttribute('download')) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return;
  }
  if (url.origin !== window.location.origin) return;
  if (!RUTAS[url.pathname]) return;

  event.preventDefault();
  navigate(url.href);
}

export function initRouter() {
  if (iniciado) return;
  iniciado = true;

  currentPath = window.location.pathname;
  const rutaActual = RUTAS[currentPath];
  if (rutaActual) {
    import(rutaActual).then(async (modulo) => {
      currentModule = modulo;
      const resultado = await modulo.mount?.({ navigate });
      if (resultado?.redirectTo) navigate(resultado.redirectTo);
    });
  }

  document.addEventListener('click', alClicSidebar);
  window.addEventListener('popstate', () => navigate(window.location.href, { isPopstate: true }));
}
