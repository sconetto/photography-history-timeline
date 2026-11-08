/** Small helpers shared by the physics widgets. */
export const $ = <T extends Element>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** A range input running 0…1000 mapped logarithmically onto [lo, hi]. */
export function logRange(input: HTMLInputElement, lo: number, hi: number) {
  const to = (v: number) => lo * Math.pow(hi / lo, v / 1000);
  const from = (x: number) => Math.round((1000 * Math.log(x / lo)) / Math.log(hi / lo));
  return { get: () => to(Number(input.value)), set: (x: number) => { input.value = String(from(clamp(x, lo, hi))); } };
}

export function fmtSec(t: number): string {
  if (t >= 3600) return `${+(t / 3600).toFixed(t >= 36000 ? 0 : 1)} h`;
  if (t >= 60) return `${+(t / 60).toFixed(t >= 600 ? 0 : 1)} min`;
  if (t >= 1) return `${+t.toFixed(t >= 10 ? 0 : 1)} s`;
  return `1/${Math.round(1 / t)} s`;
}
export function fmtMm(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  if (x < 0.1) return `${Math.round(x * 1000)} µm`;
  if (x < 10) return `${x.toFixed(2)} mm`;
  if (x < 1000) return `${Math.round(x)} mm`;
  return `${+(x / 1000).toFixed(x < 10000 ? 2 : 1)} m`;
}
export const fmtN = (N: number) => `f/${N < 10 ? +N.toFixed(1) : Math.round(N)}`;
export const fmtStops = (s: number) => `${s > 0 ? '+' : s < 0 ? '−' : '±'}${Math.abs(+s.toFixed(1))} ${Math.abs(s) === 1 ? 'stop' : 'stops'}`;

/** Deterministic random numbers (mulberry32), so redraws don't shimmer. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Standard normal sample from a uniform source (Box–Muller). */
export function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

/** Re-run a draw function when the theme or palette changes (colours read from CSS). */
export function onTheme(fn: () => void) {
  document.addEventListener('ptt:theme', fn);
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', fn);
}
export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
