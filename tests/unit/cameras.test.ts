import { describe, it, expect } from 'vitest';
import { CAMERA_TYPES, CAMERA_NAMES, cameraSvg } from '../../src/lib/cameras';

describe('camera silhouettes', () => {
  it('draws every camera type, decorative and themeable', () => {
    for (const t of CAMERA_TYPES) {
      const svg = cameraSvg(t);
      expect(svg).toMatch(/^<svg class="cam" viewBox="0 0 160 100" aria-hidden="true"/);
      expect(svg).toContain('fill="currentColor"');
      expect(svg.match(/<(rect|path|circle)/g)!.length).toBeGreaterThan(2);
      expect(CAMERA_NAMES[t].length).toBeGreaterThan(3);
    }
  });
  it('produces balanced markup', () => {
    for (const t of CAMERA_TYPES) {
      const svg = cameraSvg(t);
      expect((svg.match(/<g\b/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
    }
  });
});
