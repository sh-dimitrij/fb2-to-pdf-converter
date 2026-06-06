import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
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
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();

