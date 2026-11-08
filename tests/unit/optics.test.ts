import { describe, expect, it } from 'vitest';
import { cropFactor, equivalent, ev, stopsBetween, rayleighPinhole, angleOfView, areaRatio, FULL_FRAME_DIAGONAL,
  ev100, thinLens, hyperfocal, depthOfField, pupil, relativeLight, kelvinRgb, stackedSnr } from '../../src/lib/optics';

describe('optics', () => {
  it('full-frame diagonal is 43.27 mm', () => expect(FULL_FRAME_DIAGONAL).toBeCloseTo(43.27, 2));
  it('crop factors of common formats', () => {
    expect(cropFactor(36, 24)).toBeCloseTo(1, 5);
    expect(cropFactor(23.5, 15.6)).toBeCloseTo(1.53, 2);
    expect(cropFactor(22.3, 14.9)).toBeCloseTo(1.61, 2);
    expect(cropFactor(17.3, 13)).toBeCloseTo(2.0, 1);
    expect(cropFactor(13.2, 8.8)).toBeCloseTo(2.73, 2);
  });
  it('50 mm on Canon APS-C ≈ 80 mm equivalent', () => expect(equivalent(50, 1.8, 22.3, 14.9).focal).toBeCloseTo(80.5, 0));
  it('equivalent aperture scales with crop', () => expect(equivalent(35, 1.4, 23.5, 15.6).fNumber).toBeCloseTo(2.15, 2));
  it('f/2.8 → f/4 is one stop less light', () => expect(stopsBetween(2.8, 4)).toBeCloseTo(1, 1));
  it('EV100 of f/16 at 1/125 s ≈ 15', () => expect(ev(16, 1 / 125)).toBeCloseTo(15, 0));
  it('Rayleigh pinhole for 100 mm ≈ 0.45 mm', () => expect(rayleighPinhole(100)).toBeCloseTo(0.446, 2));
  it('50 mm on full frame: about 47° diagonal angle of view', () => expect(angleOfView(43.27, 50)).toBeCloseTo(46.8, 0));
  it('APS-C area ≈ 42% of full frame', () => expect(areaRatio(23.5, 15.6)).toBeCloseTo(0.42, 2));
});

describe('more optics', () => {
  it('EV100 accounts for ISO: sunny 16 at ISO 100 is about EV 15', () => {
    expect(ev100(16, 1 / 125, 100)).toBeCloseTo(15, 0);
    expect(ev100(16, 1 / 400, 400)).toBeCloseTo(ev100(16, 1 / 100, 100), 1);
  });
  it('thin lens: focused at 2f the image is at 2f, life size', () => {
    const { v, m } = thinLens(50, 100);
    expect(v).toBeCloseTo(100); expect(m).toBeCloseTo(1);
    expect(thinLens(50, 1e9).v).toBeCloseTo(50, 3);
  });
  it('hyperfocal distance for 50 mm at f/8 is about 10.5 m', () => expect(hyperfocal(50, 8) / 1000).toBeCloseTo(10.47, 1));
  it('depth of field widens when stopping down and reaches infinity past the hyperfocal', () => {
    const a = depthOfField(50, 2, 3000), b = depthOfField(50, 8, 3000);
    expect(b.total).toBeGreaterThan(a.total);
    expect(a.near).toBeLessThan(3000); expect(a.far).toBeGreaterThan(3000);
    expect(depthOfField(50, 16, 6000).far).toBe(Infinity);
  });
  it('pupil and light', () => { expect(pupil(50, 2)).toBe(25); expect(relativeLight(2) / relativeLight(2.8)).toBeCloseTo(1.96, 1); });
  it('black-body colour: warm at 2700 K, near white at 6500 K, bluish at 10000 K', () => {
    const [r1, , b1] = kelvinRgb(2700); expect(r1).toBe(255); expect(b1).toBeLessThan(180);
    const w = kelvinRgb(6500); expect(Math.min(...w)).toBeGreaterThan(235);
    const [r3, , b3] = kelvinRgb(10000); expect(b3).toBe(255); expect(r3).toBeLessThan(220);
  });
  it('stacking 16 frames quadruples the signal-to-noise ratio', () => expect(stackedSnr(100, 16) / stackedSnr(100, 1)).toBeCloseTo(4));
});
