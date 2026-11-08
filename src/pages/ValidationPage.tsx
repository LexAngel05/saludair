import { Icon, type IconName } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Chip } from '../components/ui';
import { es } from '../i18n/es';

const TEST_ICONS: Record<(typeof es.pages.validation.tests)[number]['key'], IconName> = {
  environment: 'mountain',
  repeatability: 'repeat',
  reference: 'target',
  battery: 'battery',
  'ble-range': 'wave',
  'led-vs-dashboard': 'bulb',
};

export function ValidationPage() {
  const s = es.pages.validation;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro}>
        <Chip tone="brand">{s.soon}</Chip>
      </PageHeader>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {s.tests.map((test, i) => (
          <li key={test.key} className="flex gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name={TEST_ICONS[test.key]} />
            </div>
            <div>
              <h2 className="font-semibold">
                <span className="mr-1.5 text-ink-faint">{i + 1}.</span>
                {test.title}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{test.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
