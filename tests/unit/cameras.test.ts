import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { CAMERA_TYPES, CAMERA_NAMES, CAMERA_MODELS, cameraDrawing } from '../../src/lib/cameras';

describe('camera drawings', () => {
  it('has a drawing for every camera entry', () => {
    const dir = 'src/content/entries';
    const cams = readdirSync(dir).filter((f) => /^cameraType:/m.test(readFileSync(`${dir}/${f}`, 'utf8'))).map((f) => f.replace(/\.mdx$/, ''));
    expect(cams.length).toBeGreaterThan(20);
    expect(cams.filter((id) => !CAMERA_MODELS.includes(id))).toEqual([]);
  });

  it('keeps the real proportions and a decorative, sized svg', () => {
    const d = cameraDrawing('leica-m3', 'rangefinder', 1, 1000);
    expect(d.own).toBe(true);
    expect(d.w / d.h).toBeCloseTo(138 / 84, 5);
    const [, , vw, vh] = d.svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/)!.slice(1).map(Number);
    const w = Number(d.svg.match(/width="(\d+)"/)![1]), h = Number(d.svg.match(/height="(\d+)"/)![1]);
    expect(Math.abs(w / h - vw / vh)).toBeLessThan(0.02); // not squashed
    expect(d.svg).toContain('aria-hidden="true"');
  });

  it('caps the width and falls back to a model of the same type', () => {
    expect(Number(cameraDrawing('giroux-camera', 'box', 1, 260).svg.match(/width="(\d+)"/)![1])).toBe(260);
    for (const t of CAMERA_TYPES) {
      const d = cameraDrawing('no-such-entry', t);
      expect(d.own).toBe(false);
      expect(d.svg.startsWith('<svg class="cam"')).toBe(true);
      expect(CAMERA_NAMES[t].length).toBeGreaterThan(3);
    }
  });
});
