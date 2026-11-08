/** Small helpers shared by the physics widgets. */
import { fmtNum, useT, type Lang } from '../../i18n';
export const $ = <T extends Element>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** A range input running 0…1000 mapped logarithmically onto [lo, hi]. */
export function logRange(input: HTMLInputElement, lo: number, hi: number) {
  const to = (v: number) => lo * Math.pow(hi / lo, v / 1000);
  const from = (x: number) => Math.round((1000 * Math.log(x / lo)) / Math.log(hi / lo));
  return { get: () => to(Number(input.value)), set: (x: number) => { input.value = String(from(clamp(x, lo, hi))); } };
}

// Formatting follows the reader's language (decimal comma in Portuguese); `lang` defaults to English for server code.
const n = (lang: Lang, x: number, d: number) => fmtNum(lang, +x.toFixed(d), d);
export function fmtSec(t: number, lang: Lang = 'en'): string {
  if (t >= 3600) return `${n(lang, t / 3600, t >= 36000 ? 0 : 1)} h`;
  if (t >= 60) return `${n(lang, t / 60, t >= 600 ? 0 : 1)} min`;
  if (t >= 1) return `${n(lang, t, t >= 10 ? 0 : 1)} s`;
  return `1/${Math.round(1 / t)} s`;
}
export function fmtMm(x: number, lang: Lang = 'en'): string {
  if (!Number.isFinite(x)) return '∞';
  if (x < 0.1) return `${Math.round(x * 1000)} µm`;
  if (x < 10) return `${fmtNum(lang, x, 2, 2)} mm`;
  if (x < 1000) return `${Math.round(x)} mm`;
  return `${n(lang, x / 1000, x < 10000 ? 2 : 1)} m`;
}
export const fmtN = (N: number, lang: Lang = 'en') => `f/${N < 10 ? n(lang, N, 1) : Math.round(N)}`;
export const fmtStops = (s: number, lang: Lang = 'en') => `${s > 0 ? '+' : s < 0 ? '−' : '±'}${n(lang, Math.abs(s), 1)} ${useT(lang)(Math.abs(s) === 1 ? 'w.stop' : 'w.stops')}`;
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
