import { useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, validateSettings, type Settings } from '../config/defaults';
import { parseBackup, type Backup } from '../core/backup';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip } from '../components/ui';
import { DB_SCHEMA_VERSION, getDb } from '../db/schema';
import { exportBackup, resetAllData, restoreBackup } from '../db/sessionsRepo';
import { es } from '../i18n/es';
import { localIso } from '../core/exportCsv';
import { downloadText } from '../platform/download';
import { useRecorder } from '../state/recorderInstance';
import { useSettings } from '../state/settings';

/** Settings shown in human units (min, s, %) — converted on save. */
interface Draft {
  caution: number;
  elevated: number;
  approved: boolean;
  shortMin: number;
  levelMin: number;
  refMin: number;
  completenessPct: number;
  minEstimateS: number;
  persistenceMin: number;
  hysteresis: number;
  clearMin: number;
  cooldownMin: number;
  staleS: number;
  warmupS: number;
  humidityPct: number;
  batteryMv: number;
  corrEnabled: boolean;
  slope: number;
  intercept: number;
  notifEnabled: boolean;
  vibrate: boolean;
  sound: boolean;
}

const toDraft = (s: Settings): Draft => ({
  caution: s.thresholds.caution,
  elevated: s.thresholds.elevated,
  approved: s.thresholdsApproved,
  shortMin: s.windows.shortMs / 60_000,
  levelMin: s.windows.levelMs / 60_000,
  refMin: s.windows.referenceMs / 60_000,
  completenessPct: s.windowCompleteness * 100,
  minEstimateS: s.minEstimateDataMs / 1000,
  persistenceMin: s.alerts.persistenceMs / 60_000,
  hysteresis: s.alerts.hysteresisFactor,
  clearMin: s.alerts.clearPersistenceMs / 60_000,
  cooldownMin: s.alerts.cooldownMs / 60_000,
  staleS: s.staleTimeoutMs / 1000,
  warmupS: s.warmupS,
  humidityPct: s.highHumidityPct,
  batteryMv: s.lowBatteryMv,
  corrEnabled: s.correction.enabled,
  slope: s.correction.slope,
  intercept: s.correction.intercept,
  notifEnabled: s.notifications.enabled,
  vibrate: s.notifications.vibrate,
  sound: s.notifications.sound,
});

const fromDraft = (d: Draft, base: Settings): Settings => ({
  ...base,
  thresholds: { caution: d.caution, elevated: d.elevated },
  thresholdsApproved: d.approved,
  windows: { shortMs: d.shortMin * 60_000, levelMs: d.levelMin * 60_000, referenceMs: d.refMin * 60_000 },
  windowCompleteness: d.completenessPct / 100,
  minEstimateDataMs: d.minEstimateS * 1000,
  alerts: {
    persistenceMs: d.persistenceMin * 60_000,
    hysteresisFactor: d.hysteresis,
    clearPersistenceMs: d.clearMin * 60_000,
    cooldownMs: d.cooldownMin * 60_000,
  },
  staleTimeoutMs: d.staleS * 1000,
  warmupS: d.warmupS,
  highHumidityPct: d.humidityPct,
  lowBatteryMv: d.batteryMv,
  correction: { enabled: d.corrEnabled, slope: d.slope, intercept: d.intercept },
  notifications: { enabled: d.notifEnabled, vibrate: d.vibrate, sound: d.sound },
});

type NumKey = { [K in keyof Draft]: Draft[K] extends number ? K : never }[keyof Draft];
type BoolKey = { [K in keyof Draft]: Draft[K] extends boolean ? K : never }[keyof Draft];

/** Which validation error key belongs to which input. */
const ERROR_FIELD: Record<string, NumKey> = {
  'thresholds.caution': 'caution',
  'thresholds.elevated': 'elevated',
  windowCompleteness: 'completenessPct',
  'alerts.hysteresisFactor': 'hysteresis',
  windows: 'levelMin',
  minEstimateDataMs: 'minEstimateS',
  'correction.slope': 'slope',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function SettingsPage() {
  const f = es.settingsForm;
  const { settings, save } = useSettings();
  const rec = useRecorder();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<Partial<Record<NumKey, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recording = rec.activeId !== null;

  // Re-sync the draft when stored settings change (e.g. finished loading from IndexedDB).
  const [syncedFrom, setSyncedFrom] = useState(settings);
  if (syncedFrom !== settings) {
    setSyncedFrom(settings);
    setDraft(toDraft(settings));
  }

  const num = (key: NumKey, label: string, step = 'any') => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(draft[key]) ? draft[key] : ''}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value === '' ? NaN : Number(e.target.value) })}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${key}-err` : undefined}
        className={`w-full rounded-[10px] border bg-surface px-3 py-2.5 text-sm ${errors[key] ? 'border-lvl-elevated-solid' : 'border-line'}`}
      />
      {errors[key] && (
        <span id={`${key}-err`} className="mt-1 block text-xs font-semibold text-lvl-elevated-fg">
          {errors[key]}
        </span>
      )}
    </label>
  );

  const bool = (key: BoolKey, label: string) => (
    <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2">
      <input
        type="checkbox"
        checked={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
        className="size-5 accent-[var(--brand)]"
      />
      {label}
    </label>
  );

  const onSave = async () => {
    const next = fromDraft(draft, settings);
    const errs: Partial<Record<NumKey, string>> = {};
    for (const k of Object.keys(draft) as (keyof Draft)[]) {
      const v = draft[k];
      if (typeof v === 'number' && (!Number.isFinite(v) || (v < 0 && k !== 'intercept'))) errs[k as NumKey] = f.invalid;
    }
    for (const e of validateSettings(next)) {
      const field = ERROR_FIELD[e];
      if (field) errs[field] = f.errors[e] ?? f.invalid;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setMessage(f.invalid);
      return;
    }
    await save(next);
    setMessage(f.saved);
  };

  const onExport = async () => {
    const backup = await exportBackup(getDb());
    downloadText(`saludair-respaldo-${localIso(Date.now()).slice(0, 10)}.json`, JSON.stringify(backup), 'application/json');
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    const r = parseBackup(await file.text(), DB_SCHEMA_VERSION);
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) setMessage(f.importErrors[r.reason]);
    else setPendingImport(r.backup);
  };

  const btn = 'rounded-[10px] px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <>
      <PageHeader title={es.pages.settings.title} intro={es.pages.settings.intro}>
        {!settings.thresholdsApproved && <Chip tone="warn">{es.levels.provisional}</Chip>}
      </PageHeader>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <Section title={f.thresholds}>
          {num('caution', `${f.caution} (${es.units.pm})`)}
          {num('elevated', `${f.elevated} (${es.units.pm})`)}
          {bool('approved', f.approved)}
        </Section>
        <Section title={f.windows}>
          {num('shortMin', f.shortWindow)}
          {num('levelMin', f.levelWindow)}
          {num('refMin', f.referenceWindow)}
          {num('completenessPct', f.completeness)}
          {num('minEstimateS', f.minEstimate)}
        </Section>
        <Section title={f.alerts}>
          {num('persistenceMin', f.persistence)}
          {num('hysteresis', f.hysteresis, '0.01')}
          {num('clearMin', f.clearPersistence)}
          {num('cooldownMin', f.cooldown)}
        </Section>
        <Section title={f.quality}>
          {num('staleS', f.stale)}
          {num('warmupS', f.warmup)}
          {num('humidityPct', f.humidity)}
          {num('batteryMv', f.battery)}
        </Section>
        <Section title={f.correction}>
          {bool('corrEnabled', f.correctionEnabled)}
          {num('slope', f.slope, '0.001')}
          {num('intercept', f.intercept, '0.01')}
        </Section>
        <Section title={f.notifications}>
          {bool('notifEnabled', f.notifEnabled)}
          {bool('vibrate', f.notifVibrate)}
          {bool('sound', f.notifSound)}
        </Section>

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur md:bottom-4">
          <button type="submit" className={`${btn} bg-brand text-brand-ink hover:opacity-90`}>
            {f.save}
          </button>
          <button type="button" onClick={() => setDraft(toDraft(DEFAULT_SETTINGS))} className={`${btn} border border-line hover:bg-surface-2`}>
            {f.restoreDefaults}
          </button>
          <p role="status" className="text-sm text-ink-muted">
            {message ?? f.snapshotNote}
          </p>
        </div>
      </form>

      <div className="mt-8">
        <Card>
          <h2 className="text-base font-semibold">{f.data}</h2>
          {recording && <p className="mt-2 text-sm text-lvl-caution-fg">{f.stopSessionFirst}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => void onExport()} className={`${btn} border border-line hover:bg-surface-2`}>
              {f.exportBackup}
            </button>
            <button type="button" disabled={recording} onClick={() => fileRef.current?.click()} className={`${btn} border border-line hover:bg-surface-2`}>
              {f.importBackup}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={recording}
              onClick={() => setConfirmReset(true)}
              className={`${btn} border border-line text-lvl-elevated-fg hover:bg-lvl-elevated-bg`}
            >
              {f.reset}
            </button>
          </div>

          {pendingImport && (
            <div role="alertdialog" aria-label={f.importBackup} className="mt-4 rounded-xl bg-lvl-caution-bg p-4 text-sm text-lvl-caution-fg">
              <p className="font-semibold">{f.importConfirm(pendingImport.tables.sessions.length)}</p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className={`${btn} bg-lvl-caution-solid text-black`}
                  onClick={async () => {
                    await restoreBackup(getDb(), pendingImport);
                    setPendingImport(null);
                    setMessage(f.importDone);
                    window.location.reload();
                  }}
                >
                  {f.importYes}
                </button>
                <button type="button" className="font-semibold underline" onClick={() => setPendingImport(null)}>
                  {es.detail.cancel}
                </button>
              </div>
            </div>
          )}

          {confirmReset && (
            <div role="alertdialog" aria-label={f.reset} className="mt-4 rounded-xl bg-lvl-elevated-bg p-4 text-sm text-lvl-elevated-fg">
              <p className="font-semibold">{f.resetConfirm}</p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className={`${btn} bg-lvl-elevated-solid text-white`}
                  onClick={async () => {
                    await resetAllData(getDb());
                    setConfirmReset(false);
                    setMessage(f.resetDone);
                  }}
                >
                  {f.resetYes}
                </button>
                <button type="button" className="font-semibold underline" onClick={() => setConfirmReset(false)}>
                  {es.detail.cancel}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
