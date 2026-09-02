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
import('virtual:pwa-register').then(({ registerSW }) => {
  registerSW({ immediate: true });
}).catch(err => {
  console.warn('SW registration failed:', err);
});
