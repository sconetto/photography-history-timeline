/**
 * Time scale for the star chart. Two modes blended by s ∈ [0, 1]:
 *   s = 0  "recent stretched": a monotone piecewise-linear scale whose knots follow where entries cluster, so
 *          photography's ~200 years get about three quarters of the width;
 *   s = 1  "true to time": every year the same width.
 */
export interface Span { y0: number; y1: number }
export const SPAN: Span = { y0: -450, y1: 2032 };

/** [year, fraction] knots, strictly increasing in both. */
export const KNOTS: [number, number][] = [
  [-450, 0], [1000, 0.06], [1600, 0.12], [1800, 0.19], [1826, 0.22], [1880, 0.37],
  [1925, 0.5], [1960, 0.62], [1990, 0.74], [2010, 0.87], [2032, 1],
];

function stretched(y: number) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [ya, fa] = KNOTS[i - 1], [yb, fb] = KNOTS[i];
    if (y <= yb) return fa + ((y - ya) / (yb - ya)) * (fb - fa);
  }
  return 1;
}

/** Fraction across the main axis, 0 at y0 and 1 at y1. Monotonic for any s in [0, 1]. */
export function frac(year: number, s: number, span: Span = SPAN): number {
  const y = Math.min(Math.max(year, span.y0), span.y1);
  const linear = (y - span.y0) / (span.y1 - span.y0);
  return (1 - s) * stretched(y) + s * linear;
}

/** Year → x pixel. */
export const xOf = (year: number, s: number, x0: number, width: number, span: Span = SPAN) => x0 + frac(year, s, span) * width;

/** Inverse of frac: the year at a fraction of the axis (bisection; frac is monotonic in the year). */
export function yearAt(f: number, s: number, span: Span = SPAN): number {
  if (f <= 0) return span.y0;
  if (f >= 1) return span.y1;
  let lo = span.y0, hi = span.y1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (frac(mid, s, span) < f) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
