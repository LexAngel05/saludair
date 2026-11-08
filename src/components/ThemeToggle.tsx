import { useState } from 'react';
import { es } from '../i18n/es';
import { Icon } from './icons';

type Theme = 'system' | 'light' | 'dark';
const ORDER: Theme[] = ['system', 'light', 'dark'];
const STORAGE_KEY = 'saludair-theme';

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  try {
    if (t === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // Storage unavailable (private mode): theme still applies for this visit.
  }
}

/** Cycles automático → claro → oscuro. Per-device preference, kept in localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const label = es.theme[theme];
  const icon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto';

  return (
    <button
      type="button"
      onClick={() => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
        applyTheme(next);
        setTheme(next);
      }}
      className="grid size-10 place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </button>
  );
}
