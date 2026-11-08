# Manual test checklist

Things automated tests can't fully cover (real hardware, Android, OS notifications).
Mark each item with the date, device/browser and who checked it. Leave notes on failures.

Legend: `[x]` checked and OK · `[ ]` pending · `[!]` checked and failed (see note)

## Already checked during development (2026-11-08, Windows 11, Chrome desktop)

- [x] App loads offline after first visit (production build, server stopped): Live, Simulator, chart, Validation, Info.
- [x] Simulator "Tráfico" ×60: alert banner appears, then clears via hysteresis.
- [x] Session start → stop → detail → CSV export (also automated in `e2e/session-flow.spec.ts`).
- [x] Light / dark theme, 375 px mobile layout without horizontal scroll.
- [x] WCAG AA contrast of all text token pairs (`npm run check:contrast`).
- [x] Bluetooth and USB buttons visible in Chrome desktop (not connected to hardware).

## Real device — USB (desktop Chrome/Edge)

- [ ] Arduino serial monitor at 115200 shows one line every 2 s matching `docs/firmware-contract.md`.
- [ ] En vivo → USB → pick the port: big number updates every 2 s; "líneas inválidas" stays 0.
- [ ] Unplug the cable: status shows "Reconectando…" / "Desconectado". Plug back in: reading resumes.
- [ ] Press the ESP32 reset button: "Reinicio del dispositivo" flag appears; packet loss does not jump.
- [ ] First 30 s after power-on show "Calentando sensor…".

## Real device — Bluetooth, desktop (Chrome/Edge on Windows/macOS)

- [ ] En vivo → Bluetooth: chooser lists only `SaludAIR…` devices.
- [ ] Readings arrive every 2 s; "Paquetes perdidos" < 1 % at 1 m.
- [ ] Turn the ESP32 off for 20 s and back on: status goes to "Reconectando…" and back to "Conectado" by itself (no new chooser).
- [ ] Disconnect button: no automatic reconnection afterwards.
- [ ] Reload the page: one tap on Bluetooth reconnects (browser asks to pick the device again — expected).

## Real device — Bluetooth, Android (Chrome)

Phone model / Android / Chrome version: ____________________

- [ ] Site opened over HTTPS (deployed URL) — Bluetooth does not work over plain HTTP on a LAN IP.
- [ ] Connect via Bluetooth; readings arrive.
- [ ] Start a session: message says the screen stays on (Screen Wake Lock). Screen does not turn off by itself.
- [ ] Turn the screen off manually for 1 min, turn on: gap recorded as a disconnection, then auto-reconnect.
- [ ] Put the tab in background for 1 min, come back: same as above.
- [ ] Notifications: allow when asked; trigger an alert (lighter or incense in a closed box — no people exposed; or Simulator "Tráfico") → system notification appears, phone vibrates.
- [ ] Notifications blocked: in-page banner still appears.
- [ ] "Instalar app" / "Agregar a pantalla principal" works; installed app opens full screen and works offline.

## iPhone / iPad (Safari)

- [ ] Bluetooth button replaced by the message explaining iOS has no Web Bluetooth.
- [ ] Simulator and the rest of the app work.

## Validation with real hardware

- [ ] Environments: interior / exterior / recorrido sessions recorded and exported.
- [ ] Repeatability: ≥ 3 runs of ≥ 10 min, same spot → CSV exported.
- [ ] Reference: CSV from a station imported (preview OK, timezone and start/end-of-hour chosen), n ≥ 10 hourly pairs.
- [ ] Battery: full charge until the device stops → runtime and mV curve.
- [ ] BLE range: 1 m steps; one session per distance with the distance set → table exported.
- [ ] LED vs dashboard: mismatch close to 0 % (otherwise firmware thresholds differ from Settings).
