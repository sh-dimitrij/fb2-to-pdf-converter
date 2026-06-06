import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

function registerServiceWorker() {
  // Регистрируем SW только в production и если поддерживается
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/fb2-to-pdf-converter/sw.js')
        .then(registration => {
          console.log('Service Worker зарегистрирован: ', registration.scope);
        })
        .catch(error => {
          console.log('Ошибка регистрации Service Worker: ', error);
        });
    });
  } else if ('serviceWorker' in navigator && process.env.NODE_ENV === 'development') {
    // В разработке просто логируем
    console.log('PWA: Service Worker не зарегистрирован в режиме разработки');
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();

