import { useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { ReferenceTest } from '../components/validation/ReferenceTest';
import { BatteryTest, BleRangeTest, EnvironmentTest, LedTest, RepeatabilityTest } from '../components/validation/tests';
import { es } from '../i18n/es';

type Key = (typeof es.pages.validation.tests)[number]['key'];

const TEST_ICONS: Record<Key, IconName> = {
  environment: 'mountain',
  repeatability: 'repeat',
  reference: 'target',
  battery: 'battery',
  'ble-range': 'wave',
  'led-vs-dashboard': 'bulb',
};

const PANELS: Record<Key, () => React.JSX.Element> = {
  environment: EnvironmentTest,
  repeatability: RepeatabilityTest,
  reference: ReferenceTest,
  battery: BatteryTest,
  'ble-range': BleRangeTest,
  'led-vs-dashboard': LedTest,
};

export function ValidationPage() {
  const s = es.pages.validation;
  const [active, setActive] = useState<Key>('environment');
  const keys = s.tests.map((t) => t.key);
  const Panel = PANELS[active];

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  const onKey = (e: KeyboardEvent) => {
    const i = keys.indexOf(active);
    const next = e.key === 'ArrowRight' ? keys[(i + 1) % keys.length] : e.key === 'ArrowLeft' ? keys[(i - 1 + keys.length) % keys.length] : null;
    if (next) {
      e.preventDefault();
      setActive(next);
      document.getElementById(`tab-${next}`)?.focus();
    }
  };

  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <div role="tablist" aria-label={s.title} onKeyDown={onKey} className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {s.tests.map((t, i) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="validation-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              <Icon name={TEST_ICONS[t.key]} size={18} />
              <span>
                <span className="mr-1 text-ink-faint">{i + 1}.</span>
                {t.title}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mb-4 text-sm text-ink-muted">{s.tests.find((t) => t.key === active)?.text}</p>
      <div id="validation-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
        <Panel />
      </div>
    </>
  );
}
