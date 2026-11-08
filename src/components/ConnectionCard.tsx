import { SIMULATOR } from '../config/simulator';
import { SIM_SCENARIOS, type SimScenario } from '../device/simulator';
import { es } from '../i18n/es';
import { liveStore, type LiveState } from '../state/liveStore';
import { Icon } from './icons';
import { Card } from './ui';

const btn =
  'flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed';

export function ConnectionCard({ live }: { live: LiveState }) {
  const s = es.pages.live;
  const connected = live.kind !== null;
  const isSim = live.kind === 'simulator';

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{s.connectTitle}</h2>
        {connected && <span className="text-xs font-medium text-ink-muted">{live.deviceName}</span>}
      </div>

      {!connected && (
        <div className="mt-4 grid gap-2">
          <button type="button" disabled className={`${btn} justify-start border border-line bg-surface-2 text-ink-faint`}>
            <Icon name="bluetooth" size={18} />
            {s.connectBle}
          </button>
          <button type="button" disabled className={`${btn} justify-start border border-line bg-surface-2 text-ink-faint`}>
            <Icon name="usb" size={18} />
            {s.connectUsb}
          </button>
          <p className="text-xs text-ink-faint">{s.connectSoon}</p>
        </div>
      )}

      <fieldset className="mt-4 space-y-3 border-t border-line pt-4">
        <legend className="sr-only">{s.connectSim}</legend>
        <label className="block text-xs font-semibold text-ink-muted" htmlFor="sim-scenario">
          {es.sim.scenario}
        </label>
        <select
          id="sim-scenario"
          value={live.sim.scenario}
          disabled={isSim}
          onChange={(e) => liveStore.setSimScenario(e.target.value as SimScenario)}
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {SIM_SCENARIOS.map((sc) => (
            <option key={sc} value={sc}>
              {es.sim.scenarios[sc]}
            </option>
          ))}
        </select>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted" id="sim-speed-label">
            {es.sim.speed}
          </p>
          <div role="radiogroup" aria-labelledby="sim-speed-label" className="grid grid-cols-3 gap-1 rounded-[10px] bg-surface-2 p-1">
            {SIMULATOR.speeds.map((sp) => (
              <button
                key={sp}
                type="button"
                role="radio"
                aria-checked={live.sim.speed === sp}
                onClick={() => liveStore.setSimSpeed(sp)}
                className={`rounded-lg py-1.5 text-sm font-semibold ${
                  live.sim.speed === sp ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {es.sim.speedLabel(sp)}
              </button>
            ))}
          </div>
        </div>

        {!connected && (
          <button type="button" onClick={() => void liveStore.connectSimulator()} className={`${btn} w-full bg-brand text-brand-ink hover:opacity-90`}>
            <Icon name="play" size={18} />
            {s.connectSim}
          </button>
        )}
      </fieldset>

      {connected && (
        <button
          type="button"
          onClick={() => void liveStore.disconnect()}
          className={`${btn} mt-4 w-full border border-line text-ink hover:bg-surface-2`}
        >
          {s.disconnect}
        </button>
      )}
    </Card>
  );
}
