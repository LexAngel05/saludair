import { useEffect, useState, type ReactNode } from 'react';
import type { TestType } from '../../config/defaults';
import { metricsCsv } from '../../core/exportCsv';
import { summarizeSession, type SessionSummary } from '../../core/stats';
import { getDb } from '../../db/schema';
import { getSessionBundle, type SessionBundle } from '../../db/sessionsRepo';
import { es } from '../../i18n/es';
import { localIso } from '../../core/exportCsv';
import { downloadText } from '../../platform/download';
import { liveStore, useLive } from '../../state/liveStore';
import { recorder, useRecorder } from '../../state/recorderInstance';
import { useSettings } from '../../state/settings';
import { Card } from '../ui';

/** All recorded sessions of one test type, newest first, reloaded when a recording stops. */
export function useTestSessions(testType: TestType | 'all'): SessionBundle[] | null {
  const rec = useRecorder();
  const [bundles, setBundles] = useState<SessionBundle[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const sessions =
        testType === 'all' ? await db.sessions.toArray() : await db.sessions.where('testType').equals(testType).toArray();
      const done = sessions.filter((s) => s.endedAt !== undefined).sort((a, b) => b.startedAt - a.startedAt);
      const out = (await Promise.all(done.map((s) => getSessionBundle(db, s.id)))).filter((b): b is SessionBundle => b !== null);
      if (alive) setBundles(out);
    })().catch(() => alive && setBundles([]));
    return () => {
      alive = false;
    };
  }, [testType, rec.activeId]);
  return bundles;
}

export function summaryOf(b: SessionBundle): SessionSummary {
  return summarizeSession({
    readings: b.readings,
    startedAt: b.session.startedAt,
    endedAt: b.session.endedAt ?? b.readings.at(-1)?.t ?? b.session.startedAt,
    alerts: b.alerts.length,
    disconnects: b.linkEvents.filter((e) => e.kind === 'disconnected').length,
    settings: b.session.settingsSnapshot,
  });
}

export function Steps({ items }: { items: readonly string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={s} className="flex gap-3 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
          <span className="pt-0.5 text-ink-muted">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Starts/stops a session of this test type from the Validation page. */
export function StartTestPanel({
  testType,
  params,
  children,
  extraTags = [],
}: {
  testType: TestType;
  params?: Record<string, number | string>;
  children?: ReactNode;
  extraTags?: import('../../config/defaults').SessionTag[];
}) {
  const v = es.validation;
  const live = useLive();
  const rec = useRecorder();
  const { settings } = useSettings();
  const connected = live.kind !== null;
  const mine = rec.activeId !== null && rec.testType === testType;
  const other = rec.activeId !== null && !mine;

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm font-semibold">{v.startTitle}</p>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {mine ? (
          <>
            <span className="text-sm font-semibold text-brand">{v.recording}</span>
            <button
              type="button"
              onClick={() => void recorder.stop(liveStore.source?.now() ?? Date.now())}
              className="rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-surface"
            >
              {v.stop}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!connected || other}
            onClick={() =>
              void recorder.start({
                startedAt: liveStore.source?.now() ?? Date.now(),
                source: live.kind!,
                ...(live.deviceName ? { deviceName: live.deviceName } : {}),
                tags: extraTags,
                testType,
                notes: '',
                ...(params ? { testParams: params } : {}),
                settings,
              })
            }
            className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {v.start}
          </button>
        )}
        {!connected && <span className="text-xs text-ink-muted">{v.needConnection}</span>}
        {other && <span className="text-xs text-lvl-caution-fg">{v.recordingOther}</span>}
      </div>
    </div>
  );
}

export function DataTable({ head, rows }: { head: readonly string[]; rows: readonly (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-2 py-2 whitespace-nowrap tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExportButton({
  test,
  meta = [],
  head,
  rows,
}: {
  test: TestType;
  meta?: [string, string | number | null][];
  head: readonly string[];
  rows: (string | number | null)[][];
}) {
  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={() =>
        downloadText(
          `saludair-validacion-${test}-${localIso(Date.now()).slice(0, 10)}.csv`,
          metricsCsv(`SaludAIR validation — ${test}`, [['exported_at_local', localIso(Date.now())], ['units', 'ug/m3'], ...meta], head, rows),
          'text/csv;charset=utf-8',
        )
      }
      className="rounded-[10px] border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
    >
      {es.validation.exportCsv}
    </button>
  );
}

export function TestLayout({ steps, start, children }: { steps: readonly string[]; start: ReactNode; children: ReactNode }) {
  const v = es.validation;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <h2 className="text-base font-semibold">{v.procedure}</h2>
        <div className="mt-4">
          <Steps items={steps} />
        </div>
        <div className="mt-5">{start}</div>
      </Card>
      <Card className="lg:col-span-3">
        <h2 className="text-base font-semibold">{v.results}</h2>
        <div className="mt-4 space-y-4">{children}</div>
      </Card>
    </div>
  );
}

export const n1 = (x: number | null | undefined) => (x === null || x === undefined ? '—' : x.toLocaleString('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
