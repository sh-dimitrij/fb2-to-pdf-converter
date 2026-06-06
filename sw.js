const CACHE_NAME = 'fb2-pdf-converter-v2';

const urlsToCache = [
  '/fb2-to-pdf-converter/',
  '/fb2-to-pdf-converter/index.html',
  '/fb2-to-pdf-converter/manifest.json',
  '/fb2-to-pdf-converter/favicon.svg',
  '/fb2-to-pdf-converter/icons/icon-192.png',
  '/fb2-to-pdf-converter/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэш открыт');
        // Загружаем каждый файл по отдельности, чтобы видеть ошибки
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
              console.warn(`Не удалось загрузить: ${url} (${response.status})`);
              return Promise.resolve();
            }).catch(err => {
              console.warn(`Ошибка загрузки: ${url}`, err);
              return Promise.resolve();
            });
          })
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // Кэшируем только успешные ответы
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});