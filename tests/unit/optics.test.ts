import { describe, expect, it } from 'vitest';
import { cropFactor, equivalent, ev, stopsBetween, rayleighPinhole, angleOfView, areaRatio, FULL_FRAME_DIAGONAL } from '../../src/lib/optics';

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
