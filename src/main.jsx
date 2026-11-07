import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initPwa, registerServiceWorker } from './lib/pwa.js';
import './styles.css';

// Start listening for the browser's install prompt before React renders anything.
initPwa();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
