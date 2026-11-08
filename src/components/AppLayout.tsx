import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { es } from '../i18n/es';
import { ROUTES } from '../routes';
import { OFFLINE_READY_EVENT } from '../pwa-events';

const NAV_ITEMS = [
  { to: ROUTES.live, label: es.nav.live, icon: 'live', end: true },
  { to: ROUTES.sessions, label: es.nav.sessions, icon: 'sessions', end: false },
  { to: ROUTES.validation, label: es.nav.validation, icon: 'validation', end: false },
  { to: ROUTES.settings, label: es.nav.settings, icon: 'settings', end: false },
  { to: ROUTES.info, label: es.nav.info, icon: 'info', end: false },
] as const;

type IconName = (typeof NAV_ITEMS)[number]['icon'];

function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'live':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" />
        </svg>
      );
    case 'sessions':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M7 15l4-4 3 3 5-6" />
        </svg>
      );
    case 'validation':
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
  }
}

function linkClass(isActive: boolean, variant: 'top' | 'bottom'): string {
  const base =
    variant === 'top'
      ? 'rounded-lg px-3 py-2 text-sm font-medium transition-colors'
      : 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium';
  const state = isActive
    ? variant === 'top'
      ? 'bg-surface-2 text-ink'
      : 'text-brand'
    : 'text-ink-muted hover:text-ink';
  return `${base} ${state}`;
}

export function AppLayout() {
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const onReady = () => setOfflineReady(true);
    window.addEventListener(OFFLINE_READY_EVENT, onReady);
    return () => window.removeEventListener(OFFLINE_READY_EVENT, onReady);
  }, []);

  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
      >
        {es.app.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to={ROUTES.live} className="flex items-center gap-2" aria-label={es.app.name}>
            <img src="icons/icon.svg" alt="" width={28} height={28} className="rounded-md" />
            <span className="text-lg font-semibold tracking-tight">{es.app.name}</span>
            <span className="hidden text-sm text-ink-muted sm:inline">· {es.app.tagline}</span>
          </NavLink>
          <nav aria-label={es.app.mainNav} className="hidden md:block">
            <ul className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive, 'top')}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {offlineReady && (
        <div role="status" className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 px-4">
          <p className="w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm">
            {es.pwa.offlineReady}{' '}
            <button type="button" className="ml-2 underline" onClick={() => setOfflineReady(false)}>
              {es.pwa.dismiss}
            </button>
          </p>
        </div>
      )}

      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <nav
        aria-label={es.app.mainNav}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="flex flex-1">
              <NavLink to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive, 'bottom')}>
                <NavIcon name={item.icon} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
