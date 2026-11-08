import { useEffect, useState } from 'react';

/**
 * Keeps the screen on while `enabled` (Screen Wake Lock API). The browser releases the
 * lock when the page is hidden, so it is re-requested when the page becomes visible.
 * Returns whether a lock is currently held.
 */
export function useWakeLock(enabled: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
        setHeld(true);
        s.addEventListener('release', () => {
          sentinel = null;
          setHeld(false);
        });
      } catch {
        setHeld(false);
      }
    };

    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
      sentinel = null;
      setHeld(false);
    };
  }, [enabled]);

  return held;
}
