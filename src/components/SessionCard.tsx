import { useState } from 'react';
import { Link } from 'react-router';
import { SESSION_TAGS, TEST_TYPES, type SessionTag, type TestType } from '../config/defaults';
import { es } from '../i18n/es';
import { formatDuration } from '../lib/format';
import { ROUTES } from '../routes';
import { liveStore, type LiveState } from '../state/liveStore';
import { recorder, useRecorder } from '../state/recorderInstance';
import { useSettings } from '../state/settings';
import { Card, Chip } from './ui';

export function SessionCard({ live }: { live: LiveState }) {
  const s = es.session;
  const { settings } = useSettings();
  const rec = useRecorder();
  const [tags, setTags] = useState<SessionTag[]>([]);
  const [testType, setTestType] = useState<TestType>('none');
  const [notes, setNotes] = useState('');
  const [lastId, setLastId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = live.kind !== null;
  const recording = rec.activeId !== null;

  const start = async () => {
    if (!live.kind) return;
    setBusy(true);
    try {
      await recorder.start({
        startedAt: liveStore.source?.now() ?? Date.now(),
        source: live.kind,
        ...(live.deviceName ? { deviceName: live.deviceName } : {}),
        tags,
        testType,
        notes: notes.trim(),
        settings,
      });
      setLastId(null);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    const id = rec.activeId;
    setBusy(true);
    try {
      await recorder.stop(liveStore.source?.now() ?? Date.now());
      setLastId(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{s.title}</h2>
        {recording && (
          <Chip tone="brand">
            <span className="size-2 animate-pulse rounded-full bg-lvl-elevated-solid" aria-hidden="true" />
            {s.recording} · {formatDuration(Math.max(0, live.now - (rec.startedAt ?? live.now)))} · {s.readings(rec.readingCount)}
          </Chip>
        )}
      </div>

      {recording ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-ink-muted">
            {rec.tags.map((t) => es.tags[t]).join(', ') || es.testTypes[rec.testType]}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void stop()}
            className="rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
          >
            {s.stop}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-ink-muted">{connected ? s.idle : s.needConnection}</p>
          {lastId !== null && (
            <p className="text-sm">
              <Link to={`${ROUTES.sessions}/${lastId}`} className="font-semibold text-brand underline">
                {s.viewLast}
              </Link>
            </p>
          )}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-ink-muted">{s.tags}</legend>
            <div className="flex flex-wrap gap-2">
              {SESSION_TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      on ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-muted hover:text-ink'
                    }`}
                  >
                    {es.tags[t]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{s.testType}</span>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as TestType)}
                className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm"
              >
                {TEST_TYPES.map((tt) => (
                  <option key={tt} value={tt}>
                    {es.testTypes[tt]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{s.notes}</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={s.notesPlaceholder}
                maxLength={500}
                className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!connected || busy}
            onClick={() => void start()}
            className="w-full rounded-[10px] bg-brand px-4 py-3 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {s.start}
          </button>
        </div>
      )}
    </Card>
  );
}
