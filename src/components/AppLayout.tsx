import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { es } from '../i18n/es';
import { OFFLINE_READY_EVENT } from '../pwa-events';
import { ROUTES } from '../routes';
import { liveStore } from '../state/liveStore';
import { useSettings } from '../state/settings';
import { Icon, type IconName } from './icons';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS: readonly { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: ROUTES.live, label: es.nav.live, icon: 'live', end: true },
  { to: ROUTES.sessions, label: es.nav.sessions, icon: 'sessions', end: false },
  { to: ROUTES.validation, label: es.nav.validation, icon: 'validation', end: false },
  { to: ROUTES.settings, label: es.nav.settings, icon: 'settings', end: false },
  { to: ROUTES.info, label: es.nav.info, icon: 'info', end: false },
];

/** Brand mark: ring + particles. Uses currentColor so it follows the theme. */
function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="text-brand">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="var(--surface)" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill="var(--surface)" />
      <circle cx="11" cy="11.2" r="1.1" fill="var(--surface)" />
      <circle cx="21.2" cy="12.3" r="0.8" fill="var(--surface)" />
      <circle cx="20.1" cy="21.1" r="1.2" fill="var(--surface)" />
    </svg>
  );
}

export function AppLayout() {
  const [offlineReady, setOfflineReady] = useState(false);
  const { settings } = useSettings();

  const { pathname } = useLocation();

  // Keep the app-wide live engine on the current settings.
  useEffect(() => liveStore.setSettings(settings), [settings]);

  // Each page starts at the top.
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  useEffect(() => {
    const onReady = () => setOfflineReady(true);
    window.addEventListener(OFFLINE_READY_EVENT, onReady);
    return () => window.removeEventListener(OFFLINE_READY_EVENT, onReady);
  }, []);

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[10px] focus:bg-surface focus:px-3 focus:py-2"
      >
        {es.app.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <NavLink to={ROUTES.live} className="flex items-center gap-2.5 rounded-[10px]" aria-label={es.app.name}>
            <LogoMark />
            <span className="text-lg font-bold tracking-tight">
              {es.app.nameStart}
              <span className="text-brand">{es.app.nameEnd}</span>
            </span>
          </NavLink>

          <nav aria-label={es.app.mainNav} className="ml-4 hidden md:block">
            <ul className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                      }`
                    }
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs font-medium text-ink-faint lg:inline">{es.app.prototypeChip}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {offlineReady && (
        <div role="status" className="mx-auto mt-4 max-w-6xl px-4">
          <p className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm">
            {es.pwa.offlineReady}
            <button type="button" className="font-semibold text-brand underline" onClick={() => setOfflineReady(false)}>
              {es.pwa.dismiss}
            </button>
          </p>
        </div>
      )}

      <main id="main" className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8">
        <Outlet />
      </main>

      <nav
        aria-label={es.app.mainNav}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="flex px-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="flex flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                    isActive ? 'text-brand' : 'text-ink-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                        isActive ? 'bg-brand-soft' : ''
                      }`}
                    >
                      <Icon name={item.icon} size={20} />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
