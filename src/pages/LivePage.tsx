import { DEFAULT_SETTINGS } from '../config/defaults';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/icons';
import { LevelBadge } from '../components/LevelBadge';
import { LevelScale } from '../components/LevelScale';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip, EmptyState, Eyebrow, StatTile } from '../components/ui';
import { es } from '../i18n/es';

/**
 * Live view. Phase 0 renders the real "disconnected / no data" state of the layout;
 * Phase 3 wires it to the device stream and computed means.
 */
export function LivePage() {
  const s = es.pages.live;
  // TODO(phase 4): read from the settings store instead of defaults.
  const settings = DEFAULT_SETTINGS;
  const dash = es.status.noValue;

  return (
    <>
      <PageHeader title={s.title} intro={s.intro}>
        <Chip>
          <span className="size-2 rounded-full bg-lvl-none-solid" aria-hidden="true" />
          {es.status.disconnected}
        </Chip>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Eyebrow>{s.shortMean}</Eyebrow>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-7xl leading-none font-bold tracking-tight text-ink-faint sm:text-8xl">
                  {dash}
                </span>
                <span className="text-lg font-semibold text-ink-muted">{es.units.pm}</span>
              </p>
              <p className="mt-3 text-sm text-ink-muted">{s.waiting}</p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Eyebrow>{s.levelMean}</Eyebrow>
              <LevelBadge level={null} size="lg" />
              {!settings.thresholdsApproved && <Chip tone="warn">{es.levels.provisional}</Chip>}
            </div>
          </div>
          <div className="mt-8">
            <LevelScale thresholds={settings.thresholds} value={null} />
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">{s.connectTitle}</h2>
          <div className="mt-4 grid gap-2">
            {(
              [
                ['bluetooth', s.connectBle],
                ['usb', s.connectUsb],
                ['play', s.connectSim],
              ] as const
            ).map(([icon, label]) => (
              <button
                key={label}
                type="button"
                disabled
                className="flex items-center gap-3 rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-left text-sm font-semibold text-ink-muted disabled:cursor-not-allowed"
              >
                <Icon name={icon} size={18} />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">{s.connectSoon}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Icon name="clock" size={18} />} label={s.tiles.updated} value={dash} />
        <StatTile icon={<Icon name="droplet" size={18} />} label={s.tiles.humidity} value={dash} unit={es.units.percent} />
        <StatTile icon={<Icon name="battery" size={18} />} label={s.tiles.battery} value={dash} unit={es.units.mv} />
        <StatTile icon={<Icon name="signal" size={18} />} label={s.tiles.loss} value={dash} unit={es.units.percent} />
      </div>

      <Card className="mt-4">
        <h2 className="text-base font-semibold">{s.trendTitle}</h2>
        <EmptyState icon={<Icon name="trend" />} text={s.trendEmpty} />
      </Card>

      <div className="mt-4">
        <Disclaimer />
      </div>
    </>
  );
}
