// Сохраняет файлы игры на телефоне, чтобы она запускалась без интернета.
// При изменении файлов игры увеличь номер версии, чтобы телефоны скачали новую.
const CACHE = 'dolgaya-noch-v5';
const FILES = [
  './',
  'index.html',
  'three.min.js',
  'game.js',
  'manifest.webmanifest',
  'fonts/fonts.css',
  'fonts/rubik-cyrillic-400-normal.woff2',
  'fonts/rubik-latin-400-normal.woff2',
  'fonts/rubik-cyrillic-500-normal.woff2',
  'fonts/rubik-latin-500-normal.woff2',
  'fonts/rubik-cyrillic-700-normal.woff2',
  'fonts/rubik-latin-700-normal.woff2',
  'fonts/unbounded-cyrillic-600-normal.woff2',
  'fonts/unbounded-latin-600-normal.woff2',
  'fonts/unbounded-cyrillic-800-normal.woff2',
  'fonts/unbounded-latin-800-normal.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Сначала сеть (чтобы получать обновления), без сети — сохранённая копия.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
