const CACHE_NAME = 'fox-eye-v0.90';
// Список усіх файлів для кешування (відповідно до твоєї структури)
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './css/maplibre-gl.css',
  './fonts/jura-v34-cyrillic_latin-700.woff2',
  './fonts/jura-v34-cyrillic_latin-regular.woff2',
  './js/app.js',
  './js/core/config.js',
  './js/core/state.js',
  './js/core/app-state.js',
  './js/core/data-manager.js',
  './js/map/map-core.js',
  './js/map/markers.js',
  './js/tools/measurements.js',
  './js/tools/ruler.js',
  './js/tools/compass.js',
  './js/tools/scanner.js',
  './js/tools/tools-core.js',
  './js/ui/icons.js',
  './js/ui/ui-utils.js',
  './js/vendor/maplibre-gl.js',
  './js/vendor/mgrs.min.js',
  './js/vendor/turf.min.js',
];

// Встановлення: Кешуємо всі ресурси
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }),
  );
});

// Активація: Видаляємо старі кеші
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
});

// Перехоплення запитів: Спочатку дивимось у кеш
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
