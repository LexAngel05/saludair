import { useEffect, useMemo, useState } from 'react';
import { ScatterChart } from '../../charts/ScatterChart';
import { DISPLAY_TIMEZONE } from '../../config/device';
import { alignToBins, compareMetrics, correctionFromFit, parseReferenceCsv, type RefParseResult, type RefRow } from '../../core/referenceAlign';
import { getDb } from '../../db/schema';
import { deleteReferenceDataset, getReferenceRows, listReferenceDatasets, saveReferenceDataset } from '../../db/referenceRepo';
import type { ReferenceDatasetRecord } from '../../db/types';
import { es } from '../../i18n/es';
import { formatDateTime, formatNumber } from '../../lib/format';
import { useSettings } from '../../state/settings';
import { ExportButton, n1, StartTestPanel, TestLayout, useTestSessions } from './shared';

const r = es.validation.ref;
const TIMEZONES = [DISPLAY_TIMEZONE, 'America/Mexico_City', 'America/Los_Angeles', 'UTC'];
const HOUR = 3_600_000;
const TEN_MIN = 600_000;

export function ReferenceTest() {
  const { settings, save } = useSettings();
  const bundles = useTestSessions('reference');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [tz, setTz] = useState(DISPLAY_TIMEZONE);
  const [marks, setMarks] = useState<'start' | 'end'>('start');
  const [name, setName] = useState('');
  const [datasets, setDatasets] = useState<ReferenceDatasetRecord[]>([]);
  const [dsId, setDsId] = useState<number | null>(null);
  const [refRows, setRefRows] = useState<RefRow[]>([]);
  const [bin, setBin] = useState<'hour' | '10min'>('hour');
  const [msg, setMsg] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const preview: RefParseResult | null = useMemo(() => (file ? parseReferenceCsv(file.text, { timezone: tz, hourMarks: marks }) : null), [file, tz, marks]);

  useEffect(() => {
    let alive = true;
    void listReferenceDatasets(getDb()).then((d) => {
      if (!alive) return;
      setDatasets(d);
      setDsId((cur) => cur ?? d[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    (dsId === null ? Promise.resolve([]) : getReferenceRows(getDb(), dsId)).then((rows) => alive && setRefRows(rows));
    return () => {
      alive = false;
    };
  }, [dsId, reload]);

  const ds = datasets.find((d) => d.id === dsId);
  const refResolution = useMemo(() => {
    const ts = refRows.map((x) => x.t).sort((a, b) => a - b);
    const diffs = ts.slice(1).map((t, i) => t - ts[i]!).sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)] ?? HOUR;
  }, [refRows]);

  const result = useMemo(() => {
    if (!bundles || refRows.length === 0) return null;
    const device = bundles.flatMap((b) => b.readings);
    device.sort((a, b) => a.t - b.t);
    const binMs = bin === '10min' && refResolution <= TEN_MIN ? TEN_MIN : HOUR;
    const aligned = alignToBins(device, refRows, { binMs, refResolutionMs: refResolution, settings });
    return { ...aligned, metrics: compareMetrics(aligned.pairs), binMs };
  }, [bundles, refRows, bin, refResolution, settings]);

  const saveDataset = async () => {
    if (!preview || !file) return;
    const id = await saveReferenceDataset(
      getDb(),
      { name: name.trim() || file.name, importedAt: Date.now(), timezone: tz, hourMarks: marks, rejectedRows: preview.rejected },
      preview.rows,
    );
    setFile(null);
    setName('');
    setDsId(id);
    setReload((x) => x + 1);
  };

  const m = result?.metrics;
  const sel = 'rounded-[10px] border border-line bg-surface px-3 py-2 text-sm';

  return (
    <TestLayout
      steps={es.validation.steps.reference}
      start={
        <div className="space-y-4">
          <StartTestPanel testType="reference" />
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">{r.importTitle}</p>
            <label className="mt-3 block text-sm">
              <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{r.file}</span>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile({ name: f.name, text: await f.text() });
                }}
                className="block w-full text-sm file:mr-3 file:rounded-[10px] file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-semibold"
              />
            </label>
            {file && preview && (
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{r.timezone}</span>
                  <select value={tz} onChange={(e) => setTz(e.target.value)} className={`${sel} w-full`}>
                    {TIMEZONES.map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{r.hourMarks}</span>
                  <select value={marks} onChange={(e) => setMarks(e.target.value as 'start' | 'end')} className={`${sel} w-full`}>
                    <option value="start">{r.hourStart}</option>
                    <option value="end">{r.hourEnd}</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{r.name}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={file.name} className={`${sel} w-full`} />
                </label>
                <p className="text-sm font-semibold">{r.preview(preview.rows.length, preview.rejected)}</p>
                <p className="text-xs text-ink-muted">{r.resolution(Math.round(preview.resolutionMs / 60_000))}</p>
                <ul className="max-h-40 overflow-y-auto rounded-lg bg-surface-2 p-2 font-mono text-xs">
                  {preview.rows.slice(0, 12).map((x) => (
                    <li key={x.t}>
                      {formatDateTime(x.t)} → {formatNumber(x.pm25, 1)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={preview.rows.length === 0}
                  onClick={() => void saveDataset()}
                  className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50"
                >
                  {r.save}
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
      {datasets.length === 0 ? (
        <p className="text-sm text-ink-muted">{r.none}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              {r.datasets}
              <select value={dsId ?? ''} onChange={(e) => setDsId(Number(e.target.value))} className={sel}>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {refResolution <= TEN_MIN && (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                {r.bin}
                <select value={bin} onChange={(e) => setBin(e.target.value as 'hour' | '10min')} className={sel}>
                  <option value="hour">{r.binHour}</option>
                  <option value="10min">{r.bin10}</option>
                </select>
              </label>
            )}
            {ds && (
              <button
                type="button"
                className="text-sm font-semibold text-lvl-elevated-fg underline"
                onClick={async () => {
                  await deleteReferenceDataset(getDb(), ds.id);
                  setDsId(null);
                  setReload((x) => x + 1);
                }}
              >
                {r.delete}
              </button>
            )}
          </div>
          <p className="text-xs text-ink-faint">
            {r.compareWith}: {r.allSessions} ({bundles?.length ?? 0})
            {ds ? ` · ${ds.timezone} · ${ds.hourMarks === 'end' ? r.hourEnd : r.hourStart}` : ''}
          </p>

          {m && (
            <>
              {!m.sufficient && <p className="rounded-xl bg-lvl-caution-bg px-3 py-2 text-sm font-semibold text-lvl-caution-fg">{r.insufficient}</p>}
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  [r.metrics.n, String(m.n)],
                  [r.metrics.meanDevice, n1(m.meanDevice)],
                  [r.metrics.meanRef, n1(m.meanReference)],
                  [r.metrics.bias, n1(m.bias)],
                  [r.metrics.mae, n1(m.mae)],
                  [r.metrics.rmse, n1(m.rmse)],
                  [r.metrics.r, m.r === null ? '—' : formatNumber(m.r, 3)],
                  [r.metrics.r2, m.r2 === null ? '—' : formatNumber(m.r2, 3)],
                ].map(([k, val]) => (
                  <div key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                    <dt className="text-xs text-ink-muted">{k}</dt>
                    <dd className="font-semibold">{val}</dd>
                  </div>
                ))}
              </dl>
              {m.slope !== null && m.intercept !== null && (
                <p className="text-sm">
                  {r.metrics.fit} {formatNumber(m.slope, 3)} {r.timesRef} {m.intercept >= 0 ? '+' : '−'} {formatNumber(Math.abs(m.intercept), 2)}
                </p>
              )}
              {result.skippedIncomplete > 0 && <p className="text-xs text-ink-faint">{r.skipped(result.skippedIncomplete)}</p>}
              {m.n > 0 && <ScatterChart pairs={result.pairs} slope={m.slope} intercept={m.intercept} />}
              <div className="flex flex-wrap gap-3">
                {m.slope !== null && m.intercept !== null && m.slope > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const corr = correctionFromFit(m.slope!, m.intercept!);
                      const rounded = { slope: Math.round(corr.slope * 1000) / 1000, intercept: Math.round(corr.intercept * 100) / 100 };
                      await save({ ...settings, correction: { ...settings.correction, ...rounded } });
                      setMsg(r.correctionSaved(rounded.slope, rounded.intercept));
                    }}
                    className="rounded-[10px] border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
                  >
                    {r.useCorrection}
                  </button>
                )}
                <ExportButton
                  test="reference"
                  meta={[
                    ['reference_dataset', ds?.name ?? null],
                    ['reference_timezone', ds?.timezone ?? null],
                    ['hour_marks', ds?.hourMarks ?? null],
                    ['bin_minutes', result.binMs / 60_000],
                    ['n', m.n],
                    ['mean_device', m.meanDevice],
                    ['mean_reference', m.meanReference],
                    ['bias', m.bias],
                    ['mae', m.mae],
                    ['rmse', m.rmse],
                    ['pearson_r', m.r],
                    ['r2', m.r2],
                    ['fit_slope', m.slope],
                    ['fit_intercept', m.intercept],
                    ['sufficient_n_ge_10', m.sufficient ? 'yes' : 'no'],
                  ]}
                  head={['bin_start_utc', 'device_mean', 'reference_mean']}
                  rows={result.pairs.map((p) => [new Date(p.t).toISOString(), p.device, p.reference])}
                />
              </div>
              {msg && <p role="status" className="text-sm text-ink-muted">{msg}</p>}
            </>
          )}
        </>
      )}
    </TestLayout>
  );
}
