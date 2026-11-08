/** Minimal reading shape the pure core needs (a subset of ReadingRecord / StreamPacket). */
export interface CoreReading {
  /** UTC epoch ms. */
  t: number;
  pm25: number;
  uptimeS: number;
  pm25Avg?: number;
  lvl?: 0 | 1 | 2;
  rh?: number | null;
  batMv?: number | null;
  bootSegment?: number;
}
