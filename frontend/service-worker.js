const CACHE_NAME = 'anfitriones-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/home.html',
  '/registro.html',
  '/hogares.html',
  '/ingresos.html',
  '/manifest.json',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/login.css',
  '/css/home.css',
  '/css/registro.css',
  '/css/hogares.css',
  '/css/ingresos.css',
  '/js/app.js',
  '/js/pages/login.js',
  '/js/pages/home.js',
  '/js/pages/registro.js',
  '/js/pages/hogares.js',
  '/js/pages/ingresos.js',
  '/js/services/api.js',
  '/js/services/session.js',
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
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
