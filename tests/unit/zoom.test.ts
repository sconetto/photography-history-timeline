import { describe, expect, it } from 'vitest';
import { frac, yearAt, SPAN } from '../../src/lib/scale';
import { zoomGeometry, visible, scrollFor, kForRange, ticksFor, ZMAX } from '../../src/lib/zoom';

const CURATED = [-400, 1, 500, 1000, 1500, 1700, 1800, 1850, 1900, 1925, 1950, 1975, 2000, 2025];

describe('zoom maths', () => {
  for (const s of [0, 1]) {
    it(`yearAt inverts frac (s=${s})`, () => {
      for (const y of [-400, 0, 1000, 1826, 1839, 1888, 1959, 2007, 2025]) expect(yearAt(frac(y, s), s)).toBeCloseTo(y, 3);
      expect(yearAt(0, s)).toBe(SPAN.y0);
      expect(yearAt(1, s)).toBe(SPAN.y1);
    });
  }
  it('the 1× desktop view covers the whole axis', () => {
    const g = zoomGeometry(1300, 1);
    expect(g.W).toBe(1300);
    expect(visible(0, 1300, g.x0, g.mainW)).toEqual([0, 1]);
  });
  it('zooming k times makes the axis k times wider', () => {
    const a = zoomGeometry(1300, 1), b = zoomGeometry(1300, 4);
    expect(b.mainW).toBeCloseTo(a.mainW * 4);
    expect(b.x0).toBe(a.x0);
  });
  it('scrollFor keeps an axis fraction under the same pixel at any zoom', () => {
    for (const k of [1, 2.5, 16]) {
      const g = zoomGeometry(1300, k), f = 0.62, px = 400;
      const sl = scrollFor(f, px, g.x0, g.mainW);
      expect((sl + px - g.x0) / g.mainW).toBeCloseTo(f, 9);
    }
  });
  it('kForRange fits a range and clamps', () => {
    const g = zoomGeometry(1300, 1);
    const k = kForRange(0.4, 0.5, 1300);
    const gk = zoomGeometry(1300, k);
    expect(0.1 * gk.mainW).toBeCloseTo(1300 - 104, 0);
    expect(g.k).toBe(1);
    expect(kForRange(0, 1, 1300)).toBe(1);
    expect(kForRange(0.5, 0.5001, 1300)).toBe(ZMAX);
  });
  it('ticksFor keeps the curated ticks at 1× and adds finer ones when zoomed', () => {
    const g1 = zoomGeometry(1440, 1);
    const at1 = ticksFor((y) => g1.x0 + frac(y, 0) * g1.mainW, SPAN.y0, SPAN.y1, CURATED);
    expect(at1).toEqual(CURATED);
    const g8 = zoomGeometry(1440, 8);
    const at8 = ticksFor((y) => g8.x0 + frac(y, 0) * g8.mainW, SPAN.y0, SPAN.y1, CURATED);
    expect(at8.slice(0, CURATED.length)).toEqual(CURATED);
    expect(at8).toContain(1990);
  });
});
