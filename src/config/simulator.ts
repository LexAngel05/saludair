/** Simulator tuning (AGENTS.md §9 → Simulator). Ticks are packet intervals (2 s). */
export const SIMULATOR = {
  baselineMean: 10,
  baselineNoise: 1.2,
  /** BLE notification payload size used to split lines (default ATT MTU 23 − 3). */
  chunkSize: 20,
  dropProbability: 0.01,
  garbageProbability: 0.005,
  garbageLines: ['#boot PMS5003 ok', 'v1,12,ab,3,4,5,4.0,0,,,', '\u0000\u0000\u0013', 'v1,1,2,3', 'ERR sensor timeout'],
  trafficSpikeEveryMin: 4,
  humidityInflation: 1.3,
  batteryStartMv: 4150,
  /** ≈ 750 mV over 8 h. */
  batteryDropPerTick: 0.052,
  disconnectEveryTicks: 150,
  disconnectForTicks: 15,
  rebootAtTick: 120,
  rebootPauseTicks: 3,
  speeds: [1, 10, 60] as const,
} as const;
