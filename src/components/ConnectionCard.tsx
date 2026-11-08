import { useState } from 'react';
import { SIMULATOR } from '../config/simulator';
import { detectSupport } from '../platform/support';
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
  const [support] = useState(() => detectSupport());

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{s.connectTitle}</h2>
        {connected && <span className="text-xs font-medium text-ink-muted">{live.deviceName}</span>}
      </div>

      {live.error && (
        <p role="alert" className="mt-3 rounded-[10px] bg-lvl-elevated-bg px-3 py-2 text-sm text-lvl-elevated-fg">
          {live.error}
        </p>
      )}

      {!connected && (
        <div className="mt-4 grid gap-2">
          {support.ble ? (
            <button
              type="button"
              onClick={() => void liveStore.connectBle()}
              className={`${btn} justify-start bg-brand text-brand-ink hover:opacity-90`}
            >
              <Icon name="bluetooth" size={18} />
              <span className="text-left">
                {s.connectBle}
                <span className="block text-xs font-medium opacity-80">{s.connectBleHint}</span>
              </span>
            </button>
          ) : (
            <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-sm text-ink-muted">
              {!support.secure ? es.support.insecure : support.ios ? es.support.ios : es.support.noBle}
            </p>
          )}
          {support.serial && (
            <button
              type="button"
              onClick={() => void liveStore.connectSerial()}
              className={`${btn} justify-start border border-line text-ink hover:bg-surface-2`}
            >
              <Icon name="usb" size={18} />
              <span className="text-left">
                {s.connectUsb}
                <span className="block text-xs font-medium text-ink-muted">{s.connectUsbHint}</span>
              </span>
            </button>
          )}
          {support.ble && <p className="text-xs text-ink-faint">{es.support.reloadHint}</p>}
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
          <button
            type="button"
            onClick={() => void liveStore.connectSimulator()}
            className={`${btn} w-full border border-brand text-brand hover:bg-brand-soft`}
          >
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
