const CACHE_NAME = 'anfitriones-v11';
const APP_SHELL = [
  '/',
  '/index.html',
  '/home.html',
  '/eventos.html',
  '/registro.html',
  '/hogares.html',
  '/hogar-detalle.html',
  '/ingresos.html',
  '/admin/dashboard.html',
  '/admin/eventos.html',
  '/admin/evento-nuevo.html',
  '/admin/usuarios.html',
  '/manifest.json',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/login.css',
  '/css/home.css',
  '/css/eventos.css',
  '/css/registro.css',
  '/css/hogares.css',
  '/css/hogar-detalle.css',
  '/css/ingresos.css',
  '/css/admin.css',
  '/js/app.js',
  '/js/mapModal.js',
  '/js/imageCompress.js',
  '/js/services/eventStream.js',
  '/js/pages/login.js',
  '/js/pages/home.js',
  '/js/pages/eventos.js',
  '/js/pages/registro.js',
  '/js/pages/hogares.js',
  '/js/pages/hogar-detalle.js',
  '/js/pages/ingresos.js',
  '/js/pages/admin-dashboard.js',
  '/js/pages/admin-eventos.js',
  '/js/pages/admin-evento-nuevo.js',
  '/js/pages/admin-usuarios.js',
  '/js/services/api.js',
  '/js/services/session.js',
  '/js/services/eventoActivo.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
