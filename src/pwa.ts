import { registerSW } from 'virtual:pwa-register';
import { OFFLINE_READY_EVENT } from './pwa-events';

/** Registers the generated service worker (production builds only). */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new Event(OFFLINE_READY_EVENT));
    },
  });
}
