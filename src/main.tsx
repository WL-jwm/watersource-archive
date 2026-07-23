import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// P4-9: PWA Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        console.log('[PWA] Service Worker 已注册，scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册失败:', err);
      });
  });
}
