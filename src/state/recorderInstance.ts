import { useSyncExternalStore } from 'react';
import { getDb } from '../db/schema';
import { liveStore } from './liveStore';
import { SessionRecorder, type RecorderState } from './recorder';

/** App-wide recorder fed by the live store. */
export const recorder = new SessionRecorder(getDb(), liveStore);

// Don't lose buffered readings if the tab is hidden or closed mid-session.
if (typeof window !== 'undefined') {
  const flush = () => void recorder.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export function useRecorder(): RecorderState {
  return useSyncExternalStore(recorder.subscribe, recorder.getState);
}
