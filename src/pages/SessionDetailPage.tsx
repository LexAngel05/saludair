import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { LEVELS } from '../config/defaults';
import { localIso, sessionCsv } from '../core/exportCsv';
import { toSeries } from '../core/series';
import { summarizeSession } from '../core/stats';
import { Icon } from '../components/icons';
import { LEVEL_STYLES, LevelBadge, LevelGlyph } from '../components/LevelBadge';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip, EmptyState } from '../components/ui';
import { getDb } from '../db/schema';
import { deleteSession, getSessionBundle, type SessionBundle } from '../db/sessionsRepo';
import { es } from '../i18n/es';
import { formatDateTime, formatDuration, formatNumber, formatTime } from '../lib/format';
import { downloadText } from '../platform/download';
import { ROUTES } from '../routes';
import { useRecorder } from '../state/recorderInstance';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

export function SessionDetailPage() {
  const d = es.detail;
  const { id } = useParams();
  const navigate = useNavigate();
  const rec = useRecorder();
  const [bundle, setBundle] = useState<SessionBundle | null | undefined>(undefined);
  const [corrected, setCorrected] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sessionId = Number(id);

  useEffect(() => {
    let alive = true;
    (Number.isInteger(sessionId) ? getSessionBundle(getDb(), sessionId) : Promise.resolve(null))
      .then((b) => alive && setBundle(b))
      .catch(() => alive && setBundle(null));
    return () => {
      alive = false;
    };
  }, [sessionId, rec.activeId]);

  const view = useMemo(() => {
    if (!bundle) return null;
    const { session, readings, alerts, linkEvents } = bundle;
    const settings = session.settingsSnapshot;
    const endedAt = session.endedAt ?? readings.at(-1)?.t ?? session.startedAt;
    const useCorr = corrected && settings.correction.enabled;
    const summary = summarizeSession({
      readings,
      startedAt: session.startedAt,
      endedAt,
      alerts: alerts.length,
      disconnects: linkEvents.filter((e) => e.kind === 'disconnected').length,
      settings,
      corrected: useCorr,
    });
    const series = toSeries(readings, useCorr ? settings.correction : undefined);
    return { summary, series, endedAt, useCorr };
  }, [bundle, corrected]);

  const header = (
    <PageHeader title={es.pages.sessionDetail.title}>
      <Link to={ROUTES.sessions} className="text-sm font-semibold text-brand underline">
        {es.pages.sessionDetail.back}
      </Link>
    </PageHeader>
  );

  if (bundle === undefined) return header;
  if (bundle === null || !view) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={<Icon name="sessions" />} text={d.notFound} />
        </Card>
      </>
    );
  }

  const { session, readings, alerts } = bundle;
  const { summary: sm, series, endedAt, useCorr } = view;
  const settings = session.settingsSnapshot;
  const v = sm.values;
  const n1 = (x: number | null) => formatNumber(x, 1);
  const pm = (x: number | null) => (x === null ? '—' : `${n1(x)} ${es.units.pm}`);
  const totalLevelMin = sm.minutesPerLevel.low + sm.minutesPerLevel.caution + sm.minutesPerLevel.elevated;

  const exportCsv = () => {
    const csv = sessionCsv({ session, readings, summary: sm, corrected: useCorr });
    const date = localIso(session.startedAt).slice(0, 10);
    downloadText(`saludair-sesion-${session.id}-${date}-${useCorr ? 'corregido' : 'crudo'}.csv`, csv, 'text/csv;charset=utf-8');
  };

  return (
    <>
      {header}
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{formatDateTime(session.startedAt)}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {formatDuration(endedAt - session.startedAt)} · {es.sources[session.source]}
                {session.deviceName ? ` (${session.deviceName})` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {session.testType !== 'none' && <Chip tone="brand">{es.testTypes[session.testType]}</Chip>}
                {session.tags.map((t) => (
                  <Chip key={t}>{es.tags[t]}</Chip>
                ))}
                {!settings.thresholdsApproved && <Chip tone="warn">{es.levels.provisional}</Chip>}
              </div>
              {session.notes && <p className="mt-2 text-sm text-ink-muted">{session.notes}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label={d.valuesLabel} className="grid grid-cols-2 gap-1 rounded-[10px] bg-surface-2 p-1">
                {[false, true].map((c) => (
                  <button
                    key={String(c)}
                    type="button"
                    role="radio"
                    aria-checked={corrected === c}
                    disabled={c && !settings.correction.enabled}
                    onClick={() => setCorrected(c)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${
                      corrected === c ? 'bg-surface text-ink shadow-card' : 'text-ink-muted'
                    }`}
                  >
                    {c ? d.valuesCorrected : d.valuesRaw}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90"
              >
                {d.exportCsv}
              </button>
            </div>
          </div>
          {!settings.correction.enabled && <p className="mt-2 text-xs text-ink-faint">{d.correctionOff}</p>}
        </Card>

        <Card>
          <h2 className="text-base font-semibold">
            {d.chartTitle} <span className="font-normal text-ink-muted">({useCorr ? d.valuesCorrected : d.valuesRaw})</span>
          </h2>
          {series.length > 1 ? (
            <div className="mt-3">
              <TimeSeriesChart
                points={series}
                thresholds={settings.thresholds}
                xMin={session.startedAt}
                xMax={endedAt}
                height={280}
                ariaLabel={d.chartAria}
                alerts={alerts.map((a) => ({ startedAt: a.startedAt, level: a.level, ...(a.endedAt ? { endedAt: a.endedAt } : {}) }))}
                seriesLabel={`PM2.5 (${useCorr ? d.valuesCorrected : d.valuesRaw})`}
              />
            </div>
          ) : (
            <EmptyState icon={<Icon name="trend" />} text={es.sessionsList.readings(readings.length)} />
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="text-base font-semibold">{d.summaryTitle}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label={d.stats.duration} value={formatDuration(sm.durationMs)} />
              <Stat label={d.stats.valid} value={`${formatNumber(sm.validPct)} %`} />
              <Stat label={d.stats.mean} value={pm(v.mean)} />
              <Stat label={d.stats.median} value={pm(v.median)} />
              <Stat label={d.stats.max} value={pm(v.max)} />
              <Stat label={d.stats.p95} value={pm(v.p95)} />
              <Stat label={d.stats.sd} value={pm(v.sd)} />
              <Stat label={d.stats.twa} value={pm(sm.twa)} />
              <Stat label={d.stats.alerts} value={String(sm.alerts)} />
              <Stat label={d.stats.loss} value={`${n1(sm.lossPct)} %`} />
              <Stat label={d.stats.disconnects} value={String(sm.disconnects)} />
              <Stat label={d.stats.reboots} value={String(sm.reboots)} />
              <Stat
                label={d.stats.battery}
                value={sm.batteryStartMv === null ? '—' : `${sm.batteryStartMv} → ${sm.batteryEndMv} mV`}
              />
              <Stat label={d.stats.rh} value={sm.rhMean === null ? '—' : `${formatNumber(sm.rhMean)} / ${formatNumber(sm.rhMax)} %`} />
            </dl>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">{d.levelsTitle}</h2>
            {totalLevelMin > 0 && (
              <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {LEVELS.map((l) =>
                  sm.minutesPerLevel[l] > 0 ? (
                    <div key={l} className={LEVEL_STYLES[l].solid} style={{ flexGrow: sm.minutesPerLevel[l] }} />
                  ) : null,
                )}
              </div>
            )}
            <ul className="mt-4 space-y-2">
              {LEVELS.map((l) => (
                <li key={l} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className={LEVEL_STYLES[l].text}>
                      <LevelGlyph level={l} size={11} />
                    </span>
                    {es.levels[l]}
                  </span>
                  <span className="text-ink-muted">
                    {formatNumber(sm.minutesPerLevel[l], 1)} min · {formatNumber(sm.pctPerLevel[l])} %
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">{d.unclassified(formatNumber(sm.unclassifiedMinutes, 1))}</p>
          </Card>
        </div>

        <Card>
          <h2 className="text-base font-semibold">{d.alertsTitle}</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">{d.noAlerts}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <LevelBadge level={a.level} />
                  <span className="text-ink-muted">
                    {formatTime(a.startedAt)} – {a.endedAt ? formatTime(a.endedAt) : '…'} · {es.alerts.peak(formatNumber(a.peak, 1))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <details>
            <summary className="cursor-pointer text-base font-semibold">{d.snapshotTitle}</summary>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-xs">
              {JSON.stringify(settings, null, 2)}
            </pre>
          </details>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          {!confirmDelete ? (
            <button
              type="button"
              disabled={rec.activeId === session.id}
              onClick={() => setConfirmDelete(true)}
              className="rounded-[10px] border border-line px-4 py-2 text-sm font-semibold text-lvl-elevated-fg hover:bg-lvl-elevated-bg disabled:opacity-40"
            >
              {d.deleteSession}
            </button>
          ) : (
            <div role="alertdialog" aria-label={d.confirmDelete} className="flex flex-wrap items-center gap-3 rounded-xl bg-lvl-elevated-bg p-3 text-sm text-lvl-elevated-fg">
              <span className="font-semibold">{d.confirmDelete}</span>
              <button
                type="button"
                onClick={async () => {
                  await deleteSession(getDb(), session.id);
                  void navigate(ROUTES.sessions);
                }}
                className="rounded-[10px] bg-lvl-elevated-solid px-3 py-1.5 font-semibold text-white"
              >
                {d.confirmYes}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="font-semibold underline">
                {d.cancel}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
