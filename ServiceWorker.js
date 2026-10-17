// Cambiar la versión cada vez que cambie la lista de recursos: al activarse,
// el Service Worker borra las cachés de versiones anteriores
const CACHE_NAME = 'issasoda-v7';

// Páginas y datos del sitio (rutas relativas a este archivo)
const SITE_FILES = [
  './',
  'index.html',
  'guat/',
  'guat/index.html',
  'guat/index.json',
  'universo/',
  'universo/index.html',
  'universo/objetos.json',
  'universo/issasoda.json',
  'acerca/',
  'acerca/index.html',
  'comun/idioma.js',
  'comun/estilo.js',
  'comun/astros.js',
  'Formulas.html',
  'formulas.json',
  'Ejercicios/RegresionLineal.html',
  'manifiesto.json',
  'favicon.ico',
  'icon.png',
  'maskable_icon.png'
];

// Librerías y fuentes externas (versiones fijas, no cambian)
const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
  'https://fonts.googleapis.com/css2?family=Rubik+Mono+One&display=swap',
  'https://fonts.googleapis.com/css2?family=Aboreto&display=swap',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap'
];

// Solo estos dominios externos se guardan en caché; el resto (Wikipedia,
// Google Docs, Spotify) pasa directo a la red
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Instalación: guardar cada recurso por separado, para que un CDN caído
// no impida instalar el Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled([...SITE_FILES, ...CDN_FILES].map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

// Activación: borrar cachés de versiones anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function saveCopy(key, response) {
  if (response.ok || response.type === 'opaque') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(key, copy));
  }
  return response;
}

// Manejo de solicitudes de red
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Sitio: primero la red (contenido siempre actualizado), la caché si no hay conexión.
    // Se guarda por ruta, sin ?consulta ni #ancla, para no duplicar la misma página
    const key = url.origin + url.pathname;
    event.respondWith(
      fetch(request)
        .then(response => saveCopy(key, response))
        .catch(() => caches.match(key))
    );
  } else if (CDN_HOSTS.includes(url.hostname)) {
    // Librerías y fuentes: primero la caché, la red solo la primera vez
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => saveCopy(request, response)))
    );
  }
});
