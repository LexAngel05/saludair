/** Which device transports this browser can use (AGENTS.md §4, platform realities). */
export interface TransportSupport {
  ble: boolean;
  serial: boolean;
  /** iPhone/iPad: no Web Bluetooth in any browser there (all use WebKit). */
  ios: boolean;
  secure: boolean;
}

export function detectSupport(nav: Navigator = navigator, secure: boolean = window.isSecureContext): TransportSupport {
  const ua = nav.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  return {
    ble: secure && 'bluetooth' in nav,
    serial: secure && 'serial' in nav,
    ios,
    secure,
  };
}
