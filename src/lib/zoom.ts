/**
 * Timeline zoom maths. Zoom is semantic: the chart is laid out k times wider (text keeps its size), and the
 * browser scrolls it horizontally. Everything here works in axis fractions (0 = start of time, 1 = today + a bit),
 * the same space as frac() in scale.ts, so the overview navigator and the chart share one coordinate system.
 */
export const ZMIN = 1;
export const ZMAX = 16;
/** Left and right padding around the time axis, in px (the right side leaves room for the TODAY mark). */
export const PAD_L = 34;
export const PAD_R = 70;
/** The chart never lays out narrower than this; narrower screens scroll even at 1×. */
export const MIN_BASE = 1080;

export const clampK = (k: number) => Math.min(ZMAX, Math.max(ZMIN, k));
const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

export interface ZoomGeometry { W: number; x0: number; mainW: number; k: number }

/** Chart geometry for a viewport width and zoom factor. At k = 1 this matches the unzoomed layout. */
export function zoomGeometry(viewport: number, k: number): ZoomGeometry {
  const base = Math.max(viewport, MIN_BASE);
  const mainW = (base - PAD_L - PAD_R) * k;
  return { W: mainW + PAD_L + PAD_R, x0: PAD_L, mainW, k };
}

/** The visible part of the axis, as fractions, for a scroll position. */
export function visible(scrollLeft: number, clientWidth: number, x0: number, mainW: number): [number, number] {
  return [clamp01((scrollLeft - x0) / mainW), clamp01((scrollLeft + clientWidth - x0) / mainW)];
}

/** The scrollLeft that puts axis fraction f at viewport x px. */
export const scrollFor = (f: number, px: number, x0: number, mainW: number) => x0 + f * mainW - px;

/** The zoom factor that fits the fraction range [fa, fb] to the viewport, with the same side margins as at 1×. */
export function kForRange(fa: number, fb: number, clientWidth: number, viewport = clientWidth): number {
  const base = Math.max(viewport, MIN_BASE);
  const span = Math.max(1e-6, Math.abs(fb - fa));
  const k = clampK(Math.max(1, clientWidth - PAD_L - PAD_R) / (span * (base - PAD_L - PAD_R)));
  return k < 1.04 ? 1 : k; // a range that nearly fills the chart means "show all"
}

/**
 * Tick candidates in priority order: the curated ticks first, then finer round years (50, 25, 10, 5, 2, 1) only
 * where one step is at least minStepPx wide on screen. The caller still drops labels that collide.
 */
export function ticksFor(xOf: (year: number) => number, y0: number, y1: number, curated: number[], minStepPx = 120): number[] {
  const out = [...curated];
  const seen = new Set(curated);
  for (const step of [50, 25, 10, 5, 2, 1]) {
    for (let t = Math.max(step, Math.ceil(y0 / step) * step); t <= y1; t += step) {
      if (seen.has(t)) continue;
      if (xOf(t + step) - xOf(t) >= minStepPx && xOf(t) - xOf(t - step) >= minStepPx) { out.push(t); seen.add(t); }
    }
  }
  return out;
}
