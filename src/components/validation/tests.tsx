import { useState } from 'react';
import { SESSION_TAGS, type SessionTag } from '../../config/defaults';
import { isWarmup } from '../../core/averaging';
import { initialSequenceState, lossPercent, trackSequence } from '../../core/sequence';
import { batteryResult, bleRangeRows, ledMismatch, reconnectTimes, repeatability } from '../../core/validation';
import { SimpleLineChart } from '../../charts/SimpleLineChart';
import { es } from '../../i18n/es';
import { formatDateTime, formatDuration } from '../../lib/format';
import { useSettings } from '../../state/settings';
import { DataTable, ExportButton, n1, StartTestPanel, summaryOf, TestLayout, useTestSessions } from './shared';

const v = es.validation;
const c = v.cols;

function Empty() {
  return <p className="text-sm text-ink-muted">{v.noSessions}</p>;
}

export function EnvironmentTest() {
  const bundles = useTestSessions('environment');
  const [tag, setTag] = useState<SessionTag>('interior');
  const head = [c.date, c.tags, c.n, c.mean, c.median, c.max, c.p95, c.sd, c.minLow, c.minCaution, c.minElevated, c.alerts];
  const rows = (bundles ?? []).map((b) => {
    const s = summaryOf(b);
    return [
      formatDateTime(b.session.startedAt),
      b.session.tags.map((t) => es.tags[t]).join(', ') || '—',
      s.values.n,
      s.values.mean,
      s.values.median,
      s.values.max,
      s.values.p95,
      s.values.sd,
      s.minutesPerLevel.low,
      s.minutesPerLevel.caution,
      s.minutesPerLevel.elevated,
      s.alerts,
    ] as (string | number | null)[];
  });
  return (
    <TestLayout
      steps={v.steps.environment}
      start={
        <StartTestPanel testType="environment" extraTags={[tag]}>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{v.tagFor}</span>
            <select value={tag} onChange={(e) => setTag(e.target.value as SessionTag)} className="w-full rounded-[10px] border border-line bg-surface px-3 py-2">
              {SESSION_TAGS.map((t) => (
                <option key={t} value={t}>
                  {es.tags[t]}
                </option>
              ))}
            </select>
          </label>
        </StartTestPanel>
      }
    >
      {bundles?.length === 0 ? (
        <Empty />
      ) : (
        <>
          <DataTable head={head} rows={rows.map((r) => r.map((x) => (typeof x === 'number' ? n1(x) : (x ?? '—'))))} />
          <ExportButton test="environment" head={head} rows={rows} />
        </>
      )}
    </TestLayout>
  );
}

export function RepeatabilityTest() {
  const bundles = useTestSessions('repeatability');
  const runs = [...(bundles ?? [])].reverse(); // oldest first = run 1
  const res = repeatability(
    runs.map((b) => ({
      id: b.session.id,
      values: b.readings.filter((r) => !isWarmup(r, b.session.settingsSnapshot)).map((r) => r.pm25),
    })),
  );
  const head = [c.session, c.date, c.n, c.mean, c.sd, c.cv];
  const rows: (string | number | null)[][] = res.runs.map((r, i) => [v.run(i + 1), formatDateTime(runs[i]!.session.startedAt), r.n, r.mean, r.sd, r.cv]);
  const acrossRow: (string | number | null)[] = [v.repeat.across, '', res.runs.length, res.across.mean, res.across.sd, res.across.cv];
  return (
    <TestLayout steps={v.steps.repeatability} start={<StartTestPanel testType="repeatability" params={{ run: runs.length + 1 }} />}>
      {bundles?.length === 0 ? (
        <Empty />
      ) : (
        <>
          <DataTable head={head} rows={[...rows, acrossRow].map((r) => r.map((x) => (typeof x === 'number' ? n1(x) : (x ?? '—'))))} />
          {!res.enoughRuns && <p className="text-sm text-lvl-caution-fg">{v.repeat.fewRuns}</p>}
          <p className="text-xs text-ink-faint">{v.repeat.cvNote}</p>
          <ExportButton test="repeatability" head={head} rows={[...rows, acrossRow]} />
        </>
      )}
    </TestLayout>
  );
}

export function BatteryTest() {
  const bundles = useTestSessions('battery');
  const [pick, setPick] = useState(0);
  const b = bundles?.[pick];
  const res = b ? batteryResult(b.readings) : null;
  const head = ['session_id', 'runtime_uptime_h', 'runtime_packets_h', 'start_mv', 'end_mv', 'rebooted'];
  const rows: (string | number | null)[][] = (bundles ?? []).map((x) => {
    const r = batteryResult(x.readings);
    return [x.session.id, r.runtimeFromUptimeS === null ? null : r.runtimeFromUptimeS / 3600, r.runtimeFromPacketsMs === null ? null : r.runtimeFromPacketsMs / 3_600_000, r.startMv, r.endMv, r.rebootedDuringTest ? 'yes' : 'no'];
  });
  return (
    <TestLayout steps={v.steps.battery} start={<StartTestPanel testType="battery" />}>
      {!b || !res ? (
        <Empty />
      ) : (
        <>
          {bundles!.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              {v.battery.pick}
              <select value={pick} onChange={(e) => setPick(Number(e.target.value))} className="rounded-[10px] border border-line bg-surface px-3 py-2">
                {bundles!.map((x, i) => (
                  <option key={x.session.id} value={i}>
                    {formatDateTime(x.session.startedAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <dl className="grid gap-2 sm:grid-cols-3">
            {[
              [v.battery.runtimeUptime, res.runtimeFromUptimeS === null ? '—' : formatDuration(res.runtimeFromUptimeS * 1000)],
              [v.battery.runtimePackets, res.runtimeFromPacketsMs === null ? '—' : formatDuration(res.runtimeFromPacketsMs)],
              [v.battery.mv, res.startMv === null ? '—' : `${res.startMv} → ${res.endMv} mV`],
            ].map(([k, val]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-ink-muted">{k}</dt>
                <dd className="font-semibold">{val}</dd>
              </div>
            ))}
          </dl>
          {res.rebootedDuringTest && <p className="text-sm text-lvl-caution-fg">{v.battery.rebooted}</p>}
          {res.curve.length > 1 ? <SimpleLineChart points={res.curve} unit="mV" ariaLabel={v.battery.chartAria} /> : <p className="text-sm text-ink-muted">{v.battery.noMv}</p>}
          <ExportButton test="battery" head={head} rows={rows} />
        </>
      )}
    </TestLayout>
  );
}

export function BleRangeTest() {
  const bundles = useTestSessions('ble-range');
  const [distance, setDistance] = useState(1);
  const runs = (bundles ?? []).map((b) => {
    let seq = initialSequenceState();
    for (const r of b.readings) seq = trackSequence(seq, r).state;
    return {
      distanceM: Number(b.session.testParams.distance_m ?? 0),
      lossPct: lossPercent(seq),
      disconnects: b.linkEvents.filter((e) => e.kind === 'disconnected').length,
      reconnectMs: reconnectTimes(b.linkEvents).times,
    };
  });
  const table = bleRangeRows(runs);
  const head = [c.distance, c.runs, c.loss, c.disconnects, c.reconnect];
  const rows: (string | number | null)[][] = table.map((r) => [r.distanceM, r.runs, r.lossPct, r.disconnects, r.meanReconnectMs === null ? null : r.meanReconnectMs / 1000]);
  return (
    <TestLayout
      steps={v.steps['ble-range']}
      start={
        <StartTestPanel testType="ble-range" params={{ distance_m: distance }}>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{v.distance}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))}
              className="w-28 rounded-[10px] border border-line bg-surface px-3 py-2"
            />
          </label>
        </StartTestPanel>
      }
    >
      {bundles?.length === 0 ? (
        <Empty />
      ) : (
        <>
          <DataTable head={head} rows={rows.map((r) => r.map((x) => (typeof x === 'number' ? n1(x) : (x ?? '—'))))} />
          <ExportButton test="ble-range" head={head} rows={rows} />
        </>
      )}
    </TestLayout>
  );
}

export function LedTest() {
  const bundles = useTestSessions('all');
  const { settings } = useSettings();
  const head = [c.session, c.date, c.n, c.mismatch];
  const rows: (string | number | null)[][] = (bundles ?? [])
    .filter((b) => b.readings.length > 0)
    .map((b) => {
      const m = ledMismatch(b.readings, settings.thresholds);
      return [b.session.id, formatDateTime(b.session.startedAt), m.n, m.pct];
    });
  return (
    <TestLayout steps={v.steps['led-vs-dashboard']} start={null}>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <>
          <DataTable head={head} rows={rows.map((r) => r.map((x) => (typeof x === 'number' ? n1(x) : (x ?? '—'))))} />
          <ExportButton
            test="led-vs-dashboard"
            meta={[['thresholds', `${settings.thresholds.caution}/${settings.thresholds.elevated}`]]}
            head={head}
            rows={rows}
          />
        </>
      )}
    </TestLayout>
  );
}
