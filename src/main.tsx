import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppRoutes } from './AppRoutes';
import { registerServiceWorker } from './pwa';
import { SettingsProvider } from './state/settings';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <SettingsProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </SettingsProvider>
  </StrictMode>,
);

registerServiceWorker();
