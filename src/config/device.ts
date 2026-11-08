/**
 * Device ↔ dashboard contract constants (AGENTS.md §5, docs/firmware-contract.md).
 * Change here only — never inline UUIDs or field specs elsewhere.
 */

export const BLE = {
  serviceUuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  /** Device → dashboard (notify). */
  txCharacteristicUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  /** Dashboard → device (write). Reserved; unused in v1. */
  rxCharacteristicUuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  namePrefix: 'SaludAIR',
  minMtu: 64,
} as const;

export const SERIAL = {
  baudRate: 115200,
} as const;

export const PACKET = {
  protocolVersion: 'v1',
  /** Nominal interval between packets. */
  intervalMs: 2000,
  lineTerminator: '\n',
  fieldSeparator: ',',
  /** Field order after the version tag. */
  fields: ['seq', 'uptimeS', 'pm1', 'pm25', 'pm10', 'pm25Avg', 'lvl', 'rh', 'temp', 'batMv'] as const,
  optionalFields: ['rh', 'temp', 'batMv'] as const,
  /** Guard against runaway buffers when a line terminator never arrives. */
  maxLineLength: 256,
} as const;

/** Plausible ranges; values outside mark the line invalid ("líneas inválidas"). */
export const FIELD_RANGES = {
  seq: { min: 0, max: 4_294_967_295 },
  uptimeS: { min: 0, max: 4_294_967_295 },
  pm1: { min: 0, max: 1000 },
  pm25: { min: 0, max: 1000 },
  pm10: { min: 0, max: 1000 },
  pm25Avg: { min: 0, max: 1000 },
  lvl: { min: 0, max: 2 },
  rh: { min: 0, max: 100 },
  temp: { min: -40, max: 85 },
  batMv: { min: 2000, max: 5000 },
} as const;

/** Display timezone. Storage is always UTC epoch ms. */
export const DISPLAY_TIMEZONE = 'America/Tijuana';
