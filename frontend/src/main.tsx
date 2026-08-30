import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import './index.css';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-update capability
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available, reloading...');
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
