// SaludAIR firmware — ESP32 DevKit V1
//
// Implements docs/firmware-contract.md: one "v1,..." line every 2 s, over
// BLE (Nordic UART Service) and USB serial, identical on both transports.
//
// SENSOR MODE: no PMS5003 wired yet, so this build EMULATES it (see
// readPm() below) so the web dashboard can be developed/tested against real
// BLE/USB hardware today. Swap readPm() for a real PMS5003 UART read later —
// everything downstream (averaging, LED, packet framing) stays the same.
//
// Debug/log lines are prefixed with '#' so the dashboard (and the contract's
// own rule) ignores them as invalid lines instead of garbage data.

#include <Arduino.h>
#include <NimBLEDevice.h>

// ---- Contract constants (must match src/config/device.ts) -----------------
static const char* SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* TX_UUID      = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify
static const char* RX_UUID      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // reserved, unused v1
static const uint32_t INTERVAL_MS = 2000;
static const float CAUTION_THRESHOLD  = 15.0f; // keep in sync with src/config/defaults.ts
static const float ELEVATED_THRESHOLD = 35.0f;

// ---- Sensor presence flags (flip when wiring real hardware) ---------------
#define HAS_PMS5003      0  // 1 once the real sensor is wired to UART2
#define HAS_RH_SENSOR    0  // 1 once a temp/humidity sensor is wired
#define HAS_BATTERY_ADC  0  // 1 once the voltage divider is wired to GPIO34

#if HAS_BATTERY_ADC
static const int BATTERY_ADC_PIN = 34; // ADC1 — ADC2 is unusable while BLE is on
#endif

static const int STATUS_LED_PIN = 2; // onboard LED on most DevKit V1 boards

// ---- BLE state --------------------------------------------------------
static NimBLECharacteristic* txChar = nullptr;
static bool bleClientConnected = false;

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& info) override {
    bleClientConnected = true;
    Serial.println("#ble: client connected");
  }
  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& info, int reason) override {
    bleClientConnected = false;
    Serial.printf("#ble: client disconnected (reason=%d), restarting advertising\n", reason);
    NimBLEDevice::startAdvertising();
  }
};

// ---- Simulated PMS5003 reading ----------------------------------------
// Baseline urban PM2.5 with slow drift + noise + occasional spikes, bounded
// to plausible ranges. Replace with a real PMS5003 UART frame read when the
// sensor is wired (see docs/firmware-contract.md §2 for the field meanings).
struct PmSample {
  float pm1;
  float pm25;
  float pm10;
};

static float simBaseline = 10.0f; // slow random-walk baseline, µg/m3
static uint32_t nextSpikeAtMs = 60000; // no spike in the first minute after boot
static float spikeRemaining = 0;

static float randf(float lo, float hi) {
  return lo + (hi - lo) * (esp_random() / (float)UINT32_MAX);
}

static PmSample readPm() {
#if HAS_PMS5003
  // TODO: read a real PMS5003 frame from UART2 and return its atmospheric
  // pm1/pm25/pm10 fields (bytes 10-15 of the frame) instead of simulating.
#endif

  uint32_t now = millis();

  // Slow baseline drift, clamped to a believable "clean-ish city air" range.
  simBaseline += randf(-0.3f, 0.3f);
  if (simBaseline < 5.0f) simBaseline = 5.0f;
  if (simBaseline > 18.0f) simBaseline = 18.0f;

  // Occasional traffic-like spike so the level/LED logic has something to
  // react to during manual testing.
  if (spikeRemaining > 0) {
    spikeRemaining -= 1.0f;
  } else if (now >= nextSpikeAtMs) {
    spikeRemaining = randf(3.0f, 8.0f); // readings-worth of elevated air
    nextSpikeAtMs = now + (uint32_t)randf(60000.0f, 180000.0f); // next spike in 1-3 min
  }

  float pm25 = simBaseline + randf(-1.0f, 1.0f);
  if (spikeRemaining > 0) pm25 += randf(25.0f, 55.0f);
  if (pm25 < 0) pm25 = 0;

  PmSample s;
  s.pm25 = pm25;
  s.pm1  = pm25 * randf(0.55f, 0.70f);
  s.pm10 = pm25 * randf(1.15f, 1.40f) + randf(0, 3.0f);
  return s;
}

// ---- 10-reading moving average (drives the LED, per contract §3) ------
static float last10[10];
static int n10 = 0, i10 = 0;

static float pushAndAverage(float pm25) {
  last10[i10] = pm25;
  i10 = (i10 + 1) % 10;
  if (n10 < 10) n10++;
  float sum = 0;
  for (int k = 0; k < n10; k++) sum += last10[k];
  return sum / n10;
}

static int levelFromAverage(float avg) {
  if (avg >= ELEVATED_THRESHOLD) return 2;
  if (avg >= CAUTION_THRESHOLD) return 1;
  return 0;
}

static void setStatusLed(int lvl) {
  // No RGB LED wired yet: blink the onboard LED faster as level rises so
  // there's a visible signal on the bench without waiting on the dashboard.
  static uint32_t lastToggle = 0;
  static bool on = false;
  uint32_t period = lvl == 2 ? 150 : (lvl == 1 ? 500 : 2000);
  uint32_t now = millis();
  if (now - lastToggle >= period) {
    lastToggle = now;
    on = !on;
    digitalWrite(STATUS_LED_PIN, on ? HIGH : LOW);
  }
}

// ---- Optional fields ----------------------------------------------------
static void formatOptionalFloat(char* out, size_t outSize, bool present, float value) {
  if (present) {
    snprintf(out, outSize, "%.1f", value);
  } else {
    out[0] = '\0';
  }
}

// ---- Setup / loop ---------------------------------------------------------
static uint32_t seq = 0;
static char deviceName[24];

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(STATUS_LED_PIN, OUTPUT);

  uint64_t mac = ESP.getEfuseMac();
  snprintf(deviceName, sizeof deviceName, "SaludAIR-%02X%02X", (uint8_t)(mac >> 8), (uint8_t)mac);

  Serial.println("#boot: SaludAIR firmware starting");
  Serial.printf("#boot: device name = %s\n", deviceName);
#if HAS_PMS5003
  Serial.println("#boot: PMS5003 = real sensor (UART2)");
#else
  Serial.println("#boot: PMS5003 = EMULATED (no sensor wired yet)");
#endif

  NimBLEDevice::init(deviceName);
  NimBLEDevice::setMTU(64);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  NimBLEService* service = server->createService(SERVICE_UUID);
  txChar = service->createCharacteristic(TX_UUID, NIMBLE_PROPERTY::NOTIFY);
  service->createCharacteristic(RX_UUID, NIMBLE_PROPERTY::WRITE); // reserved, unused v1
  server->start(); // starts all services (NimBLE 2.x: NimBLEService::start() is a no-op)

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  // The 128-bit service UUID already fills most of the 31-byte legacy
  // advertising packet, so the name (needed for the dashboard's namePrefix
  // chooser filter) has to go in the scan response instead, or setName()
  // silently drops it for lack of space.
  advertising->enableScanResponse(true);
  advertising->setName(deviceName);
  advertising->start();

  Serial.println("#ble: advertising started, waiting for the dashboard");
  Serial.println("#boot: ready");
}

void loop() {
  static uint32_t next = 0;
  uint32_t now = millis();
  if (now < next) {
    // Keep the status LED responsive between packets.
    setStatusLed(levelFromAverage(n10 ? last10[(i10 - 1 + 10) % 10] : 0));
    return;
  }
  next = now + INTERVAL_MS;

  PmSample s = readPm();
  float avg = pushAndAverage(s.pm25);
  int lvl = levelFromAverage(avg);
  setStatusLed(lvl);

  char rh[8], temp[8], bat[8];
  formatOptionalFloat(rh, sizeof rh, HAS_RH_SENSOR, 0);
  formatOptionalFloat(temp, sizeof temp, HAS_RH_SENSOR, 0);
#if HAS_BATTERY_ADC
  snprintf(bat, sizeof bat, "%u", analogReadMilliVolts(BATTERY_ADC_PIN) * 2);
#else
  bat[0] = '\0';
#endif

  char line[96];
  int len = snprintf(line, sizeof line, "v1,%lu,%lu,%.0f,%.0f,%.0f,%.1f,%d,%s,%s,%s\n",
                      (unsigned long)seq, (unsigned long)(now / 1000),
                      s.pm1, s.pm25, s.pm10, avg, lvl, rh, temp, bat);
  seq++;

  Serial.print(line);

  if (bleClientConnected && txChar != nullptr) {
    txChar->setValue((uint8_t*)line, (size_t)len);
    txChar->notify();
  }
}
