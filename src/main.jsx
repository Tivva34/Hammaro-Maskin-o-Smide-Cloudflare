import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA Registration
if (window.location.pathname.startsWith('/admin')) {
  // Admin PWA handles its own SW registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/admin' }).catch(err => {
      console.warn('Admin SW registration failed:', err);
    });
  }
} else {
  // Public PWA handled by vite-plugin-pwa virtual module
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(err => {
    console.warn('Public SW registration failed:', err);
  });
}
