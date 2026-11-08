import { LEVELS } from '../config/defaults';
import { useSettings } from '../state/settings';
import { Disclaimer } from '../components/Disclaimer';
import { LevelBadge } from '../components/LevelBadge';
import { LevelScale } from '../components/LevelScale';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip } from '../components/ui';
import { es } from '../i18n/es';

export function InfoPage() {
  const s = es.pages.info;
  const { settings } = useSettings();
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{s.levelsTitle}</h2>
            {!settings.thresholdsApproved && <Chip tone="warn">{es.levels.provisional}</Chip>}
          </div>
          <div className="mt-5">
            <LevelScale thresholds={settings.thresholds} />
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {LEVELS.map((lvl) => (
              <li key={lvl} className="rounded-xl border border-line p-4">
                <LevelBadge level={lvl} />
                <p className="mt-2 text-sm text-ink-muted">{es.levels.meaning[lvl]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-faint">{s.levelsNote}</p>
        </Card>
        <p className="text-sm text-ink-muted">{s.soon}</p>
        <Disclaimer />
      </div>
    </>
  );
}
