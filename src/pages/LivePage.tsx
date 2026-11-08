import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { AlertBanner } from '../components/AlertBanner';
import { ConnectionCard } from '../components/ConnectionCard';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/icons';
import { LevelBadge } from '../components/LevelBadge';
import { LevelScale } from '../components/LevelScale';
import { PageHeader } from '../components/PageHeader';
import { StatusBar } from '../components/StatusBar';
import { Card, Chip, EmptyState, Eyebrow, StatTile } from '../components/ui';
import { es } from '../i18n/es';
import { formatNumber } from '../lib/format';
import { useWakeLock } from '../platform/useWakeLock';
import { liveStore, useLive } from '../state/liveStore';
import { useSettings } from '../state/settings';

const LINK_TEXT = {
  disconnected: es.status.disconnected,
  connecting: es.status.connecting,
  connected: es.status.connected,
  reconnecting: es.status.reconnecting,
} as const;

const LINK_DOT = {
  disconnected: 'bg-lvl-none-solid',
  connecting: 'bg-lvl-caution-solid',
  connected: 'bg-lvl-low-solid',
  reconnecting: 'bg-lvl-caution-solid',
} as const;

export function LivePage() {
  const s = es.pages.live;
  const { settings } = useSettings();
  const live = useLive();
  const snap = live.snapshot;
  const connected = live.kind !== null;
  const wakeLock = useWakeLock(connected);

  const shortMean = snap.short.mean;
  const lvl = snap.level;
  const qualifier =
    lvl.quality === 'estimated' ? es.levels.estimated : lvl.quality === 'insufficient' && connected ? es.levels.insufficient : undefined;
  const last = snap.last;
  const agoS = last ? Math.max(0, (live.now - last.t) / 1000) : null;
  const dash = es.status.noValue;

  return (
    <>
      <PageHeader title={s.title} intro={s.intro}>
        <Chip>
          <span className={`size-2 rounded-full ${LINK_DOT[live.link]}`} aria-hidden="true" />
          {LINK_TEXT[live.link]}
        </Chip>
      </PageHeader>

      <div className="space-y-4">
        {live.banner && <AlertBanner banner={live.banner} onDismiss={() => liveStore.dismissBanner()} />}

        {live.unknownVersion && (
          <p role="alert" className="rounded-xl bg-lvl-elevated-bg px-4 py-3 text-sm font-semibold text-lvl-elevated-fg">
            {s.unknownVersion(live.unknownVersion)}
          </p>
        )}

        {connected && <StatusBar flags={snap.flags} />}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <Eyebrow>{s.shortMean}</Eyebrow>
                <p className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`text-7xl leading-none font-bold tracking-tight sm:text-8xl ${
                      shortMean === null ? 'text-ink-faint' : 'text-ink'
                    }`}
                  >
                    {shortMean === null ? dash : formatNumber(shortMean)}
                  </span>
                  <span className="text-lg font-semibold text-ink-muted">{es.units.pm}</span>
                </p>
                <p className="mt-3 text-sm text-ink-muted">
                  {!connected
                    ? s.waiting
                    : agoS === null
                      ? LINK_TEXT[live.link]
                      : `${s.tiles.updated}: ${agoS < 1.5 ? es.time.justNow : es.time.ago(agoS)}`}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Eyebrow>{s.levelMean}</Eyebrow>
                <LevelBadge level={lvl.level} size="lg" {...(qualifier ? { qualifier } : {})} />
                {lvl.value !== null && lvl.level && (
                  <p className="text-sm font-semibold text-ink-muted">
                    {formatNumber(lvl.value, 1)} {es.units.pm}
                  </p>
                )}
                {!settings.thresholdsApproved && <Chip tone="warn">{es.levels.provisional}</Chip>}
              </div>
            </div>
            <div className="mt-8">
              <LevelScale thresholds={settings.thresholds} value={lvl.level ? lvl.value : null} />
            </div>
          </Card>

          <ConnectionCard live={live} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Icon name="target" size={18} />} label={s.hourMean} value={formatNumber(snap.hour.mean)} unit={es.units.pm} />
          <StatTile icon={<Icon name="droplet" size={18} />} label={s.tiles.humidity} value={formatNumber(last?.rh)} unit={es.units.percent} />
          <StatTile icon={<Icon name="battery" size={18} />} label={s.tiles.battery} value={formatNumber(last?.batMv)} unit={es.units.mv} />
          <StatTile
            icon={<Icon name="signal" size={18} />}
            label={s.tiles.loss}
            value={connected ? formatNumber(live.lossPct, 1) : dash}
            unit={es.units.percent}
          />
        </div>

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{s.trendTitle}</h2>
            {connected && live.invalidLines > 0 && <span className="text-xs text-ink-faint">{s.invalidLines(live.invalidLines)}</span>}
          </div>
          {snap.trend.length > 1 ? (
            <div className="mt-3">
              <TimeSeriesChart
                points={snap.trend}
                thresholds={settings.thresholds}
                xMin={live.now - 10 * 60_000}
                xMax={live.now}
                ariaLabel={s.trendAria}
              />
            </div>
          ) : (
            <EmptyState icon={<Icon name="trend" />} text={s.trendEmpty} />
          )}
        </Card>

        {connected && (
          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Icon name="sun" size={18} />
            {wakeLock ? s.wakeLockOn : s.keepOpen}
          </p>
        )}

        <Disclaimer />
      </div>
    </>
  );
}
