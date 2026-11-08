import type { ReactNode } from 'react';
import { LEVELS } from '../config/defaults';
import { Disclaimer } from '../components/Disclaimer';
import { Icon, type IconName } from '../components/icons';
import { LevelBadge } from '../components/LevelBadge';
import { LevelScale } from '../components/LevelScale';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip } from '../components/ui';
import { es } from '../i18n/es';
import { useSettings } from '../state/settings';

function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon name={icon} size={18} />
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>
    </Card>
  );
}

export function InfoPage() {
  const s = es.pages.info;
  const { settings } = useSettings();

  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <div className="mx-auto max-w-3xl space-y-4">
        <Section icon="leaf" title={s.whatTitle}>
          {s.what.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Section>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{s.levelsTitle}</h2>
            {settings.thresholdsApproved ? <Chip tone="brand">{es.levels.approved}</Chip> : <Chip tone="warn">{es.levels.provisional}</Chip>}
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
          <p className="mt-4 text-xs text-ink-faint">{settings.thresholdsApproved ? s.levelsNoteApproved : s.levelsNote}</p>
        </Card>

        <Section icon="bulb" title={s.ledTitle}>
          {s.led.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Section>

        <Section icon="target" title={s.useTitle}>
          <ul className="list-disc space-y-2 pl-5">
            {s.use.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Section>

        <Section icon="info" title={s.limitsTitle}>
          <dl className="space-y-3">
            {s.limits.map((l) => (
              <div key={l.title}>
                <dt className="font-semibold text-ink">{l.title}</dt>
                <dd>{l.text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section icon="settings" title={s.privacyTitle}>
          <p>{s.privacy}</p>
        </Section>

        <Section icon="sessions" title={s.sourcesTitle}>
          <ol className="list-decimal space-y-2 pl-5">
            {s.sources.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="text-xs text-ink-faint">{s.sourcesNote}</p>
        </Section>

        <Disclaimer />
        <p className="text-center text-xs text-ink-faint">{s.team}</p>
      </div>
    </>
  );
}
