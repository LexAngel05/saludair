export interface Pt {
  t: number;
  v: number;
}

/** Largest-Triangle-Three-Buckets downsampling (Steinarsson, 2013). Keeps visual shape and peaks. */
export function lttb(data: readonly Pt[], threshold: number): Pt[] {
  const n = data.length;
  if (threshold >= n || threshold < 3) return [...data];
  const out: Pt[] = [data[0]!];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgT = 0;
    let avgV = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgT += data[j]!.t;
      avgV += data[j]!.v;
    }
    const len = Math.max(1, avgEnd - avgStart);
    avgT /= len;
    avgV /= len;

    const start = Math.floor(i * every) + 1;
    const end = Math.floor((i + 1) * every) + 1;
    const pa = data[a]!;
    let maxArea = -1;
    let next = start;
    for (let j = start; j < end; j++) {
      const p = data[j]!;
      const area = Math.abs((pa.t - avgT) * (p.v - pa.v) - (pa.t - p.t) * (avgV - pa.v));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    out.push(data[next]!);
    a = next;
  }
  out.push(data[n - 1]!);
  return out;
}

/**
 * Downsamples a series that uses `v: null` markers for gaps: each continuous segment
 * gets a share of the point budget proportional to its length, gaps are preserved.
 */
export function decimateWithGaps(data: readonly { t: number; v: number | null }[], maxPoints: number): { t: number; v: number | null }[] {
  if (data.length <= maxPoints) return [...data];
  const segments: Pt[][] = [[]];
  const gaps: { t: number; v: null }[] = [];
  for (const p of data) {
    if (p.v === null) {
      gaps.push({ t: p.t, v: null });
      segments.push([]);
    } else segments.at(-1)!.push({ t: p.t, v: p.v });
  }
  const total = data.length - gaps.length;
  const out: { t: number; v: number | null }[] = [];
  segments.forEach((seg, i) => {
    const budget = Math.max(3, Math.round((seg.length / total) * (maxPoints - gaps.length)));
    out.push(...lttb(seg, budget));
    const gap = gaps[i];
    if (gap) out.push(gap);
  });
  return out;
}
