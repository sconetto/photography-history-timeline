import { describe, expect, it } from 'vitest';
import { frac, SPAN, xOf, fmtYear } from '../../src/lib/scale';
import { place, type Box } from '../../src/lib/layout';

describe('scale', () => {
  for (const s of [0, 0.5, 1]) {
    it(`maps the ends and is monotonic (s=${s})`, () => {
      expect(frac(SPAN.y0, s)).toBeCloseTo(0, 6);
      expect(frac(SPAN.y1, s)).toBeCloseTo(1, 6);
      let prev = -Infinity;
      for (let y = SPAN.y0; y <= SPAN.y1; y += 7) { const f = frac(y, s); expect(f).toBeGreaterThan(prev); prev = f; }
    });
  }
  it('stretched mode gives the last two centuries most of the width', () => {
    expect(1 - frac(1826, 0)).toBeGreaterThan(0.75);
    expect(1 - frac(1826, 1)).toBeLessThan(0.1);
  });
  it('clamps years outside the span', () => expect(xOf(-5000, 0, 10, 100)).toBe(10));
  it('formats BCE years', () => { expect(fmtYear(-400)).toBe('400 BCE'); expect(fmtYear(1839)).toBe('1839'); });
});

describe('label layout', () => {
  it('never overlaps labels in the same row', () => {
    const rows: Box[][] = [];
    const xs = [100, 110, 120, 300, 305, 900, 905, 910, 915];
    for (const x of xs) place(rows, x, 5, 80, 1000);
    for (const row of rows) for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
      expect(row[i].x1 <= row[j].x0 || row[j].x1 <= row[i].x0).toBe(true);
    }
  });
  it('flips labels near the right edge to the left', () => {
    expect(place([], 990, 5, 80, 1000).anchor).toBe('end');
    expect(place([], 100, 5, 80, 1000).anchor).toBe('start');
  });
});

import { KNOTS } from '../../src/lib/scale';
describe('knots', () => {
  it('are strictly increasing and span the axis', () => {
    expect(KNOTS[0]).toEqual([SPAN.y0, 0]);
    expect(KNOTS.at(-1)).toEqual([SPAN.y1, 1]);
    for (let i = 1; i < KNOTS.length; i++) { expect(KNOTS[i][0]).toBeGreaterThan(KNOTS[i - 1][0]); expect(KNOTS[i][1]).toBeGreaterThan(KNOTS[i - 1][1]); }
  });
});
