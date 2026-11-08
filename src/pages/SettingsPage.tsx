import { DEFAULT_SETTINGS } from '../config/defaults';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip } from '../components/ui';
import { es } from '../i18n/es';

export function SettingsPage() {
  const s = es.pages.settings;
  // TODO(phase 4): editable form backed by settingsRepo.
  const st = DEFAULT_SETTINGS;
  const min = (ms: number) => s.minutes(ms / 60_000);
  const rows: [string, string][] = [
    [s.current.thresholds, `${st.thresholds.caution} / ${st.thresholds.elevated} ${es.units.pm}`],
    [s.current.levelWindow, min(st.windows.levelMs)],
    [s.current.persistence, min(st.alerts.persistenceMs)],
    [s.current.cooldown, min(st.alerts.cooldownMs)],
    [s.current.warmup, s.seconds(st.warmupS)],
    [s.current.stale, s.seconds(st.staleTimeoutMs / 1000)],
  ];

  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">{s.soon}</p>
          {!st.thresholdsApproved && <Chip tone="warn">{es.levels.provisional}</Chip>}
        </div>
        <dl className="mt-4 divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
