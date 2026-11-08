# SaludAIR — Firmware ↔ Dashboard contract (v1)

This is what the ESP32 firmware must send so the dashboard can read it. If the firmware
follows this page, the dashboard works over **Bluetooth (BLE)** and over **USB serial**
with no other changes. The single source of these values in the dashboard code is
`src/config/device.ts` (and `src/config/defaults.ts` for thresholds).

## 1. Transport

### BLE — Nordic UART Service (NUS) layout

| Item | Value |
|---|---|
| Device name | must **start with** `SaludAIR` (e.g. `SaludAIR-01`) — the browser chooser filters by this prefix |
| Service UUID | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| TX characteristic (device → dashboard), **notify** | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |
| RX characteristic (dashboard → device), write | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` — reserved, **unused in v1** |
| MTU | request ≥ 64 (a full line then fits in one notification). Smaller MTUs still work: the dashboard reassembles chunks until `\n`. |

### USB serial

* 115200 baud, 8N1.
* Print **exactly the same line** with `Serial.print(line)` (the line already ends in `\n`).
* Don't print other text on the serial port while connected. If you need debug output,
  start those lines with `#` — the dashboard counts them as invalid lines and ignores them.

## 2. Packet format

One UTF-8 text line per packet, **every 2 s**, terminated by `\n`:

```
v1,<seq>,<uptime_s>,<pm1>,<pm25>,<pm10>,<pm25_avg>,<lvl>,<rh>,<temp>,<bat_mv>
```

Example:

```
v1,1842,3684,9,14,18,13.6,0,41.2,27.8,3910
```

| # | Field | Type | Meaning | Valid range |
|---|---|---|---|---|
| 0 | `v1` | text | Protocol version. Anything else is shown as an error. | `v1` |
| 1 | `seq` | integer | +1 per packet; **resets to 0 at boot** | 0 – 4294967295 |
| 2 | `uptime_s` | integer | Seconds since power-on (`millis()/1000`) | 0 – 4294967295 |
| 3 | `pm1` | number | PMS5003 PM1.0 **atmospheric** (bytes 10–11), µg/m³ | 0 – 1000 |
| 4 | `pm25` | number | PMS5003 PM2.5 **atmospheric** (bytes 12–13), µg/m³ | 0 – 1000 |
| 5 | `pm10` | number | PMS5003 PM10 **atmospheric** (bytes 14–15), µg/m³ | 0 – 1000 |
| 6 | `pm25_avg` | number | Average of the **last 10** `pm25` readings (drives the LED) | 0 – 1000 |
| 7 | `lvl` | integer | Level shown by the LED: `0` Bajo, `1` Precaución, `2` Elevado | 0 – 2 |
| 8 | `rh` | number or **empty** | Relative humidity %, empty if there is no sensor | 0 – 100 |
| 9 | `temp` | number or **empty** | Temperature °C, empty if there is no sensor | −40 – 85 |
| 10 | `bat_mv` | integer or **empty** | Battery voltage in mV, empty if not measured | 2000 – 5000 |

Rules:

* Decimal point is `.`; no thousands separators, no spaces, no units.
* Optional fields that you don't have stay **empty but keep their commas**:
  `v1,5,12,3,4,6,4.2,0,,,` (11 fields always).
* A value outside its range makes the dashboard discard that line ("líneas inválidas").
* **No clock needed.** The ESP32 has no RTC; the dashboard timestamps each line when it arrives.
* **Reboots:** after a reset `seq` and `uptime_s` start again from 0. The dashboard detects
  this as a new boot segment (not as lost packets) — just make sure both restart.
* **Lost packets:** the dashboard counts missing `seq` numbers. Never skip or repeat `seq`
  on purpose; increment it once per line you *build*, even if BLE is not connected.
* **Warm-up:** the dashboard ignores readings with `uptime_s < 30` for averages and alerts
  (the PMS5003 fan/laser needs time to stabilize). Keep sending them anyway.

## 3. LED thresholds (must match the dashboard)

The LED uses `pm25_avg` (last 10 readings ≈ 20 s). The dashboard level uses a 5-minute
mean, so the LED reacts faster — that is expected and explained on the Info page.

| `lvl` | LED | Condition on `pm25_avg` |
|---|---|---|
| 0 | green — Bajo | `< 15` |
| 1 | amber — Precaución | `≥ 15` and `< 35` |
| 2 | red — Elevado | `≥ 35` |

These thresholds are **provisional** (WHO 2021 guideline 15 µg/m³; Imperial County
episode threshold 35 µg/m³) until the team reviews NOM-172-SEMARNAT-2023 and the professor
approves them. If they change, change them in both places: firmware and dashboard
Settings. The Validation page has a "LED vs dashboard" test that shows any mismatch.

## 4. Arduino-style pseudocode

```cpp
// Libraries: NimBLE-Arduino (or the ESP32 BLE library), a PMS5003 reader.
#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
#define RX_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   // reserved
const uint32_t INTERVAL_MS = 2000;
const float CAUTION = 15.0, ELEVATED = 35.0;                   // keep in sync with the dashboard

uint32_t seq = 0;
float last10[10]; int n10 = 0, i10 = 0;

void setup() {
  Serial.begin(115200);
  pms.begin();                                   // PMS5003 on UART2
  NimBLEDevice::init("SaludAIR-01");
  NimBLEDevice::setMTU(64);
  auto server  = NimBLEDevice::createServer();
  auto service = server->createService(SERVICE_UUID);
  txChar = service->createCharacteristic(TX_UUID, NIMBLE_PROPERTY::NOTIFY);
  service->createCharacteristic(RX_UUID, NIMBLE_PROPERTY::WRITE);   // unused in v1
  service->start();
  NimBLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  NimBLEDevice::getAdvertising()->start();
  // Restart advertising when a client disconnects, so the dashboard can reconnect.
}

void loop() {
  static uint32_t next = 0;
  if (millis() < next) return;
  next += INTERVAL_MS;

  PmsData d;
  if (!pms.read(d)) return;                      // no fresh frame: skip, don't send stale data

  // 10-reading moving average for the LED
  last10[i10] = d.pm25_atm; i10 = (i10 + 1) % 10; if (n10 < 10) n10++;
  float avg = 0; for (int k = 0; k < n10; k++) avg += last10[k]; avg /= n10;
  int lvl = avg >= ELEVATED ? 2 : (avg >= CAUTION ? 1 : 0);
  setLed(lvl);                                   // green / amber / red

  char rh[8] = "", temp[8] = "", bat[8] = "";    // empty when not available
  if (hasRhSensor) { snprintf(rh, sizeof rh, "%.1f", readRh()); snprintf(temp, sizeof temp, "%.1f", readTemp()); }
  if (measuresBattery) snprintf(bat, sizeof bat, "%u", readBatteryMv());

  char line[96];
  snprintf(line, sizeof line, "v1,%lu,%lu,%u,%u,%u,%.1f,%d,%s,%s,%s\n",
           (unsigned long)seq, (unsigned long)(millis() / 1000),
           d.pm1_atm, d.pm25_atm, d.pm10_atm, avg, lvl, rh, temp, bat);
  seq++;

  Serial.print(line);                            // USB
  if (bleConnected) { txChar->setValue((uint8_t*)line, strlen(line)); txChar->notify(); }
}
```

Battery voltage (optional): a 100 kΩ / 100 kΩ divider from the battery to an ADC1 pin
(e.g. GPIO34), `bat_mv = analogReadMilliVolts(34) * 2`. ADC2 pins don't work while
Bluetooth is on.

## 5. Quick self-test

1. Open the Arduino serial monitor at 115200: you should see one line every 2 s that
   looks exactly like the example.
2. In the dashboard (Chrome/Edge on a computer), **En vivo → USB**: the big number
   should update every 2 s and "líneas inválidas" should stay at 0.
3. Then **En vivo → Bluetooth**: pick `SaludAIR-…` in the chooser.
4. Turn the ESP32 off and on: the dashboard must show "Reinicio del dispositivo",
   not packet loss.
