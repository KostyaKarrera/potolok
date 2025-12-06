// Service Worker для кэширования статических ресурсов
// Версия кэша - обновляйте при изменении ресурсов
const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `potolok-cache-${CACHE_VERSION}`;

// Ресурсы для кэширования при установке
const STATIC_CACHE = [
  '/',
  '/css/style.min.css',
  '/js/main.min.js',
  '/css/font-awesome-custom.css',
  '/fonts/Montserrat-Regular.woff2',
  '/fonts/Montserrat-Medium.woff2',
  '/fonts/Montserrat-SemiBold.woff2',
  '/fonts/Montserrat-Bold.woff2',
  '/favicon.png',
  '/logo/logo.png',
  '/logo/mobile/logo.webp',
  '/header/header-optimized.webp'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE).catch((err) => {
        console.warn('Не удалось закэшировать некоторые ресурсы:', err);
      });
    })
  );
  self.skipWaiting(); // Активируем сразу
});

// Активация и очистка старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Стратегия кэширования: Cache First для статики, Network First для HTML
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Пропускаем API запросы и внешние ресурсы
  if (url.pathname.startsWith('/api/') || 
      url.origin !== self.location.origin ||
      request.method !== 'GET') {
    return; // Не кэшируем
  }
  
  // Для изображений - Network First (чтобы получать обновления сразу)
  if (/\.(webp|png|jpg|jpeg|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback на кэш только если сеть недоступна
        return caches.match(request);
      })
    );
  } 
  // Для CSS, JS, шрифтов - Cache First (они версионируются через имена файлов)
  else if (/\.(css|js|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  } else {
    // Для HTML - Network First (чтобы получать обновления)
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});

