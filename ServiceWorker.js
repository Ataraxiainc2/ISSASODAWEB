// Definir el nombre de la caché y los recursos para almacenar en caché
const CACHE_NAME = 'my-cache-v1';
const urlsToCache = [
  // Agrega aquí otros recursos que quieras guardar en caché
  'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.js',
  'https://fonts.googleapis.com/css2?family=Aboreto&display=swap',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap'
];

// Instalación del Service Worker y almacenamiento en caché de recursos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Manejo de solicitudes de red
self.addEventListener('fetch', event => {
  event.respondWith(
    // Intenta primero obtener el recurso de la red
    fetch(event.request).catch(() => {
      // Si la solicitud a la red falla, intenta obtener el recurso desde el caché
      return caches.match(event.request);
    })
  );
});
