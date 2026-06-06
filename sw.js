// Имя кэша - обновляйте при изменении файлов
const CACHE_NAME = 'fb2-pdf-converter-v2';
// Файлы для кэширования при установке
const urlsToCache = [
  '/fb2-to-pdf-converter/',
  '/fb2-to-pdf-converter/index.html',
  '/fb2-to-pdf-converter/manifest.json',
  '/fb2-to-pdf-converter/favicon.svg',
  '/fb2-to-pdf-converter/icon-192.png',
  '/fb2-to-pdf-converter/icon-512.png'
];

// Установка service worker и кэширование файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэш открыт');
        return cache.addAll(urlsToCache);
      })
  );
});

// Перехват запросов и ответ из кэша при наличии
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кэшированный ответ или делаем сетевой запрос
        if (response) {
          return response;
        }
        
        // Клонируем запрос, так как он может использоваться только один раз
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ, так как он может использоваться только один раз
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          }
        );
      })
  );
});

// Обновление service worker и очистка старого кэша
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});