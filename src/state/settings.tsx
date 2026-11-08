import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../config/defaults';
import { getDb } from '../db/schema';
import { loadSettings, saveSettings } from '../db/settingsRepo';

interface SettingsCtx {
  settings: Settings;
  loaded: boolean;
  save(next: Settings): Promise<void>;
}

const Ctx = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, loaded: false, save: async () => {} });

/** Loads settings from IndexedDB (defaults until loaded) and persists changes. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings(getDb())
      .then((s) => alive && setSettings(s))
      .catch(() => {
        // IndexedDB unavailable (private mode): keep defaults for this visit.
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (next: Settings) => {
    setSettings(next);
    await saveSettings(getDb(), next);
  }, []);

  const value = useMemo(() => ({ settings, loaded, save }), [settings, loaded, save]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx);
}
