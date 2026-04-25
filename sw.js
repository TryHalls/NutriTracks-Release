/* ================================================================
   NutriTrack Pro — Service Worker v3
   Estrategia:
     · App Shell + CDN → Cache-First (offline robusto)
     · API externa (OFF, Gemini) → Network-First (datos frescos)
     · Navegación → Network con fallback a index.html
   ================================================================ */

const CACHE_NAME = 'nutritrack-pro-cache-v3';

/* Recursos locales a cachear en la instalación */
const APP_SHELL_LOCAL = [
  './',
  './index.html',
  './css/style.css?v=16.0',
  './js/script.js?v=26.0',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* Recursos de CDN externos a cachear (Google Fonts + Chart.js) */
const APP_SHELL_CDN = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap'
];

const APP_SHELL = [...APP_SHELL_LOCAL, ...APP_SHELL_CDN];

/* ── INSTALL: pre-cachear todo el shell ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        /* Cachear locales con addAll; CDN de forma individual para no
           bloquear la instalación si un recurso externo falla */
        return cache.addAll(APP_SHELL_LOCAL).then(() =>
          Promise.allSettled(
            APP_SHELL_CDN.map(url =>
              cache.add(new Request(url, { mode: 'cors' })).catch(() => {
                /* Silenciar errores de CDN en instalación offline */
              })
            )
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpiar cachés antiguas ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* 1. Navegación (HTML) → Network-First con fallback a index.html */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.ok &&
            response.headers.get('content-type')?.includes('text/html')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 2. APIs externas (Open Food Facts, Gemini, etc.) → Network-Only */
  const isExternalAPI =
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('generativelanguage.googleapis.com');

  if (isExternalAPI) {
    /* Sin interceptar: dejar pasar al navegador */
    return;
  }

  const isStaticCode = ['script', 'style'].includes(event.request.destination);
  if (isStaticCode) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors' || response.type === 'default')
          ) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* 3. CDN externos (Fonts, Chart.js) + recursos locales → Cache-First */

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors' || response.type === 'default')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          if (event.request.destination === 'image') {
            return caches.match('./icons/icon-192.png');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
