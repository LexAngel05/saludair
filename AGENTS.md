# AGENTS.md — SaludAIR Dashboard

## 1. Read-me-first

**Read this whole file before doing anything. If the chat was reset, check [Current status](#12-current-status) and continue with the next unchecked task. Talk to the user in Spanish.**

- UI text: Spanish. Code, comments, commits, docs: English.
- `CLAUDE.md` only points here. This file is the source of truth.
- One phase at a time. End each phase with `npm run test` + `npm run build` passing, this file updated, a commit `phase N: …`, a 3–5 line Spanish summary, then **stop and wait for "continúa"**.

---

## 2. Project summary

SaludAIR is a low-cost wearable PM2.5 monitor for people with asthma in Mexicali / Valle de Mexicali (chemistry course project at CETYS). Team: Ángel Amaya, Román Meza, Clío Parra, Raúl Solís.

**Hardware:** Plantower PMS5003 (UART; PM1.0/PM2.5/PM10 by laser scattering) + ESP32 DevKit V1 + RGB LED (green / amber / red) + rechargeable battery; optional temperature/humidity sensor.

The proposal planned a mobile app. We build a **web dashboard (installable PWA)** instead. It must:

- connect to the device and show the current reading and exposure level,
- fire alerts that never trigger on a single isolated reading,
- store history locally and show it in simple charts,
- explain what PM2.5 is and the prototype's limitations,
- measure and document how well the prototype works — a core feature (§8).

**Not a medical device.** It doesn't diagnose asthma or predict crises; it reports approximate exposure to support simple decisions (reduce outdoor activity, move away from a source). Exact disclaimer, shown on **Live** and **Info**:

> "SaludAIR es un prototipo educativo. Sus lecturas son aproximadas y no sustituyen la indicación de un profesional de salud ni las estaciones oficiales de monitoreo."

Requirements from the proposal: works without internet (device → browser directly); shows lost connection and stale readings; alerts use an average plus minimum persistence; user can review recent readings; simple language, color always paired with text; data stored locally, no medical information requested.

---

## 3. Scope

**v1:** Web Bluetooth (primary), Web Serial over USB (desktop bench tests), Simulator, live view, alerts, sessions with tags, history charts, validation module, CSV/JSON export, settings, info page, PWA (offline + installable).

**Not in v1:** native app, accounts, backend, sending data anywhere, geolocation, medical data, gas sensors (CO/NO₂), crisis prediction, writing settings to the device over BLE RX (future idea).

---

## 4. Stack and platform realities

- Vite + React + TypeScript (strict), Tailwind CSS (v4, `@tailwindcss/vite`) — current stable versions.
- Chart.js via react-chartjs-2 + `chartjs-plugin-annotation` (threshold bands) + built-in decimation (LTTB) for long sessions. Time axis needs a date adapter (`chartjs-adapter-date-fns`) — decimation only works on linear/time axes with `parsing: false`.
- IndexedDB via Dexie, schema version + migrations from day one.
- `vite-plugin-pwa`: service worker, offline app shell, installable manifest.
- Web Bluetooth, Web Serial and Simulator behind one `DeviceSource` interface.
- Vitest for pure logic; Playwright for E2E using the Simulator.
- React Router (hash router, so static hosting on GitHub Pages works without rewrites).
- Static deploy (GitHub Pages / Vercel) over HTTPS.

**Platform realities (handle all):**

- Web Bluetooth: Chrome/Edge desktop and Chrome on Android. Not Safari/iOS → clear message + Simulator and CSV import.
- Web Serial: desktop Chrome/Edge only. Hide it where unsupported.
- "Works without internet" = app loads offline after the first visit → PWA caching. Test with the network off.
- Android notifications require `ServiceWorkerRegistration.showNotification()` (`new Notification()` fails there). Also use `navigator.vibrate` and an in-page banner + optional sound.
- Screen off / background tab can suspend the page and drop BLE on Android. During an active session: request a Screen Wake Lock, warn the user to keep the page open, record any gap as a disconnection, auto-reconnect to the same `BluetoothDevice` when visible again. After a full reload the user must pick the device again (browser rule) — make that one tap.
- Background tabs throttle timers → never rely on `setInterval` for timing; compute everything from packet timestamps.
- No runtime external requests: fonts are system/self-hosted, no CDNs, no analytics.

---

## 5. Data contract (device → dashboard)

Full detail for firmware teammates: `docs/firmware-contract.md` (written in Phase 5). Constants live in `src/config/device.ts`.

**BLE (Nordic UART Service layout):**

| Item | Value |
|---|---|
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| TX notify (device → dashboard) | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |
| RX write (reserved, unused in v1) | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| Device name prefix | `SaludAIR` |
| MTU | firmware requests ≥ 64 |

One UTF-8 line per packet, `\n`-terminated, same format over BLE and USB serial, every 2 s:

```
v1,<seq>,<uptime_s>,<pm1>,<pm25>,<pm10>,<pm25_avg>,<lvl>,<rh>,<temp>,<bat_mv>
```

| Field | Meaning |
|---|---|
| `v1` | Protocol version; unknown version → visible error |
| `seq` | +1 per packet, resets to 0 on boot |
| `uptime_s` | Seconds since device power-on (drives warm-up, detects reboots) |
| `pm1`, `pm25`, `pm10` | PMS5003 atmospheric values, µg/m³ |
| `pm25_avg` | Device moving average of the last 10 sensor readings (drives the LED) |
| `lvl` | Level the LED shows: 0 Bajo, 1 Precaución, 2 Elevado |
| `rh`, `temp` | Optional; empty if no sensor |
| `bat_mv` | Battery mV; empty if not measured |

Example: `v1,1842,3684,9,14,18,13.6,0,41.2,27.8,3910`

Rules:

- ESP32 has no RTC → dashboard timestamps each packet on arrival. Store UTC epoch ms; display in `America/Tijuana`.
- Parser handles partial BLE chunks (buffer until `\n`), empty optional fields, out-of-range values and garbage lines — count them as "líneas inválidas", never crash.
- `seq` or `uptime_s` going backwards = device reboot: new boot segment, not packet loss.
- Packet loss = missing `seq` values within a boot segment.
- UUIDs, interval and packet spec in `src/config/`. `docs/firmware-contract.md`: format, example, UUIDs, interval, LED thresholds (same as §8.2), Arduino-style pseudocode for building the line.

---

## 6. Data handling rules

- Raw readings are **never modified**. Corrections (e.g. calibration factor) are applied at read time; every chart/export states raw vs corrected.
- Each session stores a **snapshot of the settings** used (thresholds, windows, persistence, correction factor, approved yes/no), so old results stay reproducible.
- Volume ≈ 1,800 packets/hour. Batch IndexedDB writes (every 5–10 s) and decimate charts for long sessions.

---

## 7. Project layout notes (Phase 0)

- `src/config/defaults.ts` — `Settings` type, `DEFAULT_SETTINGS`, `mergeSettings` (stored ⊕ defaults, ignores junk), `validateSettings`.
- `src/config/device.ts` — BLE UUIDs, serial baud, packet field list, plausible field ranges, display timezone.
- `src/db/schema.ts` — Dexie DB; `SCHEMA_VERSIONS` array: append a new entry to migrate, never edit an old one. Extra tables beyond the prompt: `linkEvents` (disconnect/reconnect gaps) and `referenceDatasets` (import metadata).
- `src/db/settingsRepo.ts` — load/save/reset settings (single row id `current`).
- `src/i18n/es.ts` — all UI strings. `src/routes.ts` — route paths. `src/AppRoutes.tsx` — routes (HashRouter in `main.tsx`, MemoryRouter in tests).
- `src/pwa.ts` — service worker registration (prod only); `scripts/gen-icons.mjs` regenerates PNG icons from the same design as `public/icons/icon.svg`.
- `.claude/launch.json` — `preview` (port 4173) and `dev` (5173) for the browser pane. Note: the preview build registers a service worker; after a rebuild, reload (or unregister the SW) to see changes.
- UI kit: `components/ui.tsx` (Card, Eyebrow, Chip, EmptyState, StatTile), `components/icons.tsx` (stroke icon set), `LevelBadge` (+ `LEVEL_STYLES`, `LevelGlyph`), `LevelScale` (3-segment scale from configured thresholds), `ThemeToggle`. Design tokens in `src/index.css` (CSS vars + Tailwind `@theme inline`). Reuse these instead of new ad-hoc styles.
- Live page already renders the real "disconnected / no data" layout (big 1-min value, 5-min badge, scale, connection card, stat tiles, trend card); Phase 3 wires data into it. Settings/Info/Live read `DEFAULT_SETTINGS` until Phase 4 adds the settings store (marked `TODO(phase 4)`).
- Toolchain at setup: Node 24, Vite 8, React 19, TS 6, Tailwind 4, Vitest 5, Dexie 4, react-router 8, vite-plugin-pwa 2.

---

## 8. Measurement methodology (implement exactly; all numbers configurable in Settings)

Defaults live in `src/config/defaults.ts`. Never hard-code thresholds/windows in components.

### 8.1 Signal handling

- **Warm-up:** readings with `uptime_s < 30` are flagged "Calentando sensor…" and excluded from stats and alerts. (Depends on sensor power-on, not browser connection.)
- **Time-based rolling means** of raw pm25, computed from packet timestamps:
  - 1-min mean → big number on Live ("Ahora, promedio 1 min")
  - 5-min mean → level badge and alerts ("Nivel, promedio 5 min")
  - 1-h mean → reference comparison
- A window is **complete** with ≥ 75 % of expected samples. Before the 5-min window is complete but with ≥ 1 min of valid data → show level marked **"estimado"**; with less → **"datos insuficientes"**.
- Label both values clearly so 40 next to a "Precaución" badge doesn't look like a bug.

### 8.2 Exposure levels (provisional)

| Level | 5-min mean PM2.5 | Color + text |
|---|---|---|
| Bajo | < 15 µg/m³ | green, "Bajo" |
| Precaución | 15 – < 35 µg/m³ | amber, "Precaución" |
| Elevado | ≥ 35 µg/m³ | red, "Elevado" |

15 µg/m³ = WHO 2021 24-h guideline; 35 µg/m³ = hourly episode threshold used by the Imperial County community network (both cited in the proposal). Orientative exposure indicators, **not** the official Índice AIRE Y SALUD; the team must review NOM-172-SEMARNAT-2023 and get professor approval. Show **"umbrales provisionales"** until a Settings toggle marks them approved.

The LED reacts faster (10-reading average) than the dashboard level (5-min average). Explain on Info so users aren't confused when they differ briefly.

### 8.3 Alert logic (pure, fully tested state machine)

- **Fire** when the 5-min mean stays ≥ a level threshold for ≥ 2 min continuously.
- **Escalate immediately** (Precaución → Elevado) once Elevado's condition (≥ 35 for ≥ 2 min) is met.
- **De-escalate / clear one level at a time** when the 5-min mean stays < that level's threshold × 0.9 for ≥ 2 min (hysteresis).
- **Cooldown** 10 min before notifying the same level again.
- **Pause** during warm-up and while stale/disconnected; resume without firing on old data.
- Store each alert: start, end, peak, level, session.

### 8.4 Data-quality flags (always visible in a status bar)

| Flag | Condition |
|---|---|
| Desconectado | no link |
| Lectura desactualizada | connected but no packet for > 10 s |
| Pérdida de paquetes | % missing seq per session |
| Humedad alta | RH > 80 %: "la lectura puede estar sobreestimada" (Plantower overreads at high humidity) |
| Calentando sensor | `uptime_s < 30` |
| Reinicio del dispositivo | boot segment changed |
| Batería baja | `bat_mv` below a configurable value |

### 8.5 Validation module (dedicated page, guided step by step)

Every test is a session with a test type. Results export to CSV for the written report.

| Test | Procedure | Metrics |
|---|---|---|
| Environments | Sessions tagged interior / exterior / fuente controlada (no people exposed to smoke) / recorrido | mean, median, max, P95, SD, minutes in each level, # alerts |
| Repeatability | Stationary, same spot, ≥ 10 min, ≥ 3 runs | mean, SD and CV % per run and across runs (CV inflates at very low concentrations → always show SD too) |
| Reference comparison | Import CSV `timestamp,pm25` from an official station or nearby monitor; co-locate if possible | see below |
| Battery | Full charge, run until device stops | runtime from `uptime_s` and first→last packet, mV curve |
| BLE range & reconnect | 1 m steps away from device; BT off/on | packet loss % per distance, # disconnects, mean reconnect time |
| LED vs dashboard | Any session | % of packets where device `lvl` ≠ level computed from `pm25_avg` with dashboard thresholds |

**Reference import:** preview before saving; ask the file's timezone (default `America/Tijuana`) and whether hourly timestamps mark start or end of the hour; reject unparseable rows with a count. Align device and reference to hourly means (≥ 75 % completeness; allow 10-min alignment if the reference has finer resolution). Compute n, mean device, mean reference, bias, MAE, RMSE, Pearson r, R², linear fit (slope, intercept). Scatter plot with 1:1 line and fit line. If n < 10 → "muestra insuficiente para conclusiones". Offer the fit as optional correction factor (off by default; see §6).

### 8.6 Session summary (shown + exported for every session)

Duration, valid-data %, mean / median / max / P95, time-weighted average, minutes and % per level, # alerts, packet loss %, # disconnects, # reboots, battery start/end, RH mean/max, tags, settings snapshot.

**Exports:** CSV with a metadata header (session, dates, units, raw/corrected, settings snapshot) + per-reading rows; JSON for full backup/restore of all data.

---

## 9. Pages, simulator, structure, testing

### Pages

- **En vivo** — big 1-min value, level badge (5-min, color + text), time since last update, status bar (§8.4), 10-min sparkline with threshold bands, battery, RH, connect button (BLE / USB / Simulador), start/stop session with tags, disclaimer.
- **Sesiones** — list with filters by tag/test type; detail with time-series chart (threshold bands, alert markers, gaps shown as gaps), summary, export.
- **Validación** — tests in §8.5, guided, with results and export.
- **Configuración** — thresholds, windows, persistence, hysteresis, cooldown, staleness timeout, warm-up, RH and battery limits, approval toggle, correction factor, export/import backup, reset data (with confirmation).
- **Información** — what PM2.5 is, what each level means, LED vs dashboard timing, limitations (calibration, humidity, airflow, placement — don't cover the air inlet), sources from the proposal.

Design: calm, readable at a glance on laptop and Android phone. Responsive, light/dark, WCAG AA, color never the only signal, keyboard navigable. Not a generic template.

### Simulator

Emits the exact §5 line format (exercises the real parser). Baseline 8–12 µg/m³ with noise, spikes 40–80, RH drift, random dropped seq, a reboot event, warm-up from `uptime_s = 0`, slowly falling `bat_mv`, occasional garbage lines. Scenarios: limpio / tráfico / fuente controlada / humedad alta / desconexión / reinicio. Speed-up ×1, ×10, ×60 via simulated timestamps.

### Structure

```
src/
  device/      DeviceSource interface, bleSource, serialSource, simulatorSource, lineParser
  core/        averaging, levels, alerts, quality, stats, validation, referenceAlign (pure + tested)
  db/          Dexie schema + migrations: sessions, readings, alerts, referenceData, settings
  config/      defaults (thresholds, windows, UUIDs, interval)
  pages/       Live, Sessions, SessionDetail, Validation, Settings, Info
  components/  LevelBadge, BigReading, StatusBar, TimeSeriesChart, ScatterChart, StatCard
  i18n/        es.ts (every UI string)
docs/
  firmware-contract.md
  manual-test-checklist.md
```

### Testing

- **Unit (Vitest)**, written first for `src/core` and the parser: partial chunks, garbage lines, reboot detection, loss %, window completeness, "estimado" level, alert fire/escalate/clear/cooldown, single spike never alerts, stats vs hand-computed fixtures, reference alignment with timezone and start/end-of-hour.
- **E2E (Playwright)** with Simulator: connect → session → alert → stop → summary → export downloads.
- **Manual:** real BLE/USB, Android, offline, notifications → `docs/manual-test-checklist.md`, mark what was checked.

---

## 10. Commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` |
| Unit tests | `npm run test` |
| Unit tests (watch) | `npm run test:watch` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| E2E | `npm run test:e2e` (Phase 8) |
| Build | `npm run build` |
| Preview build | `npm run preview` |
| Deploy | TBD in Phase 8 |

---

## 11. Working rules for agents

1. Read AGENTS.md first; work on the next unchecked task unless told otherwise.
2. One phase at a time; end each phase with tests + build passing, AGENTS.md updated, a commit, a short Spanish summary, then wait for "continúa".
3. Business logic only in `src/core` as pure, tested functions; components only render.
4. No hard-coded thresholds, windows, UUIDs or UI strings outside `src/config/` and `src/i18n/`.
5. Raw data is never modified; sessions keep a settings snapshot.
6. No data leaves the browser; no external requests at runtime.
7. Color always paired with text; disclaimer on Live and Info.
8. Use the relevant skills on each phase (see Skills per phase below).
9. Decision changed → update AGENTS.md + Decision log; never diverge silently.
10. Blocked on a team decision → add to Open questions, keep going with the Simulator.

**Skills per phase** (Claude Code `anthropic-skills:*`; if missing, use the closest one):

| Phase | Skills |
|---|---|
| 0 | context-engineering, planning-and-task-breakdown, incremental-implementation |
| 1–2 | test-driven-development, api-and-interface-design, incremental-implementation |
| 3–4 | frontend-ui-engineering, dataviz, test-driven-development |
| 5 | security-and-hardening, debugging-and-error-recovery, documentation-and-adrs |
| 6 | dataviz, test-driven-development |
| 7 | frontend-ui-engineering, code-simplification, code-review-and-quality |
| 8 | browser testing (built-in browser pane; no Playwright skill exists — use Playwright directly), shipping-and-launch, ci-cd-and-automation |

---

## 12. Current status

- [x] **Phase 0 Setup** (2026-11-08): tooling, strict TS, Tailwind, routing, i18n, settings defaults, Dexie schema v1, PWA skeleton, CI-ready scripts
- [ ] **Phase 1 Data layer:** line parser + tests, DeviceSource, Simulator
- [ ] **Phase 2 Core logic:** averages, levels, alert state machine, quality flags, stats + tests
- [ ] **Phase 3 Live page** + notifications (service worker), wake lock
- [ ] **Phase 4 Sessions:** persistence, list, detail, charts, CSV/JSON export, backup/restore
- [ ] **Phase 5 Real device:** Web Bluetooth, Web Serial, reconnect, browser-support messages, docs/firmware-contract.md
- [ ] **Phase 6 Validation page:** all tests, reference import, scatter, metrics export
- [ ] **Phase 7 Info page and polish:** responsive, dark mode, empty states, accessibility pass, offline check
- [ ] **Phase 8** E2E tests, deploy, README for teammates, manual checklist

**Next task:** Phase 1 — write `src/device/lineParser.ts` tests first (partial chunks, garbage, empty optional fields, out-of-range, unknown version, reboot/boot segments, loss %), then `DeviceSource` interface and `simulatorSource`.

---

## 13. Session notes

- 2026-11-08 — Phase 0 done: Vite+React+TS strict, Tailwind v4, hash routing with 6 placeholder pages, `i18n/es.ts`, `config/` (defaults, device, levels), Dexie schema v1 with tables + settings repo, PWA skeleton (manifest + generated SW), Vitest setup with config/db/routing tests (19 passing), lint + build passing, checked in browser (desktop + mobile, dark mode, SW registered, offline-ready banner). — Next: Phase 1.
- 2026-11-08 — Visual pass (skill used: frontend-ui-engineering): Manrope font, new tokens, header + bottom nav redesign, theme toggle, UI kit components, Live layout in disconnected state, Validation test cards, Settings current-values list, Info level legend. Checked in browser light/dark, desktop/mobile. — Next: Phase 1.

---

## 14. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-08 | Dashboard/PWA instead of native app | One codebase for laptop + Android, installable, no app-store process |
| 2026-11-08 | Web Bluetooth + Web Serial + Simulator behind one `DeviceSource` | BLE for wearable use, USB for bench tests, Simulator for development/tests without hardware |
| 2026-11-08 | NUS UUIDs + `v1` CSV line with `uptime_s` | Standard UART-over-BLE layout; text line is easy to debug on serial monitor; uptime drives warm-up and reboot detection |
| 2026-11-08 | Provisional 15 / 35 µg/m³ on 5-min mean | WHO 2021 24-h guideline and Imperial County episode threshold, pending NOM-172 review + professor approval |
| 2026-11-08 | Raw data immutable + settings snapshot per session | Reproducible results after settings change |
| 2026-11-08 | HashRouter instead of BrowserRouter | Works on GitHub Pages without 404 rewrites; also simplifies offline SW navigation |
| 2026-11-08 | Tailwind v4 via `@tailwindcss/vite` (no tailwind.config) | Current stable; tokens defined in CSS `@theme` |
| 2026-11-08 | ~~System font stack~~ → Manrope Variable self-hosted via `@fontsource-variable/manrope` (bundled, precached as woff2) | User asked for a more attractive UI; bundled font keeps "no external requests" and works offline |
| 2026-11-08 | Visual system: teal brand, cards 16px / controls 10px / chips full radius, one soft header glow, level glyphs (circle / triangle / square) + text | Calm, not template-looking; level never conveyed by color alone |
| 2026-11-08 | Theme toggle (auto / claro / oscuro) added early, stored in localStorage (`saludair-theme`) with a pre-paint script in `index.html` | Per-device UI preference, not app data |
| 2026-11-08 | Settings stored as a single Dexie row (`settings` table, id `current`) merged over defaults | Adding new settings later doesn't need a migration |

---

## 15. Open questions

- Final thresholds after NOM-172-SEMARNAT-2023 review and professor approval
- Temp/humidity sensor: yes/no, which one?
- Will the ESP32 measure battery voltage (divider on an ADC pin)?
- Which reference data, and can we co-locate the device with it?
- Is 2 s between packets OK for battery life, or 5 s?
- Which phone(s) will we test on (Android model / Chrome version)?
- Deploy target: GitHub Pages or Vercel? (affects `base` path in `vite.config.ts`)
