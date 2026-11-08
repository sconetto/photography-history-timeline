/** Pure optics maths shared by the physics widgets and the formats page. All lengths in millimetres. */

export const FULL_FRAME_DIAGONAL = Math.hypot(36, 24); // 43.266 mm

export const diagonal = (w: number, h: number) => Math.hypot(w, h);

/** Crop factor relative to 35mm full frame (36 × 24 mm). */
export const cropFactor = (w: number, h: number) => FULL_FRAME_DIAGONAL / diagonal(w, h);

/** Area as a fraction of full frame. */
export const areaRatio = (w: number, h: number) => (w * h) / (36 * 24);

/** Full-frame-equivalent focal length and f-number (same framing, depth of field and total light). */
export function equivalent(focal: number, fNumber: number, w: number, h: number) {
  const c = cropFactor(w, h);
  return { focal: focal * c, fNumber: fNumber * c, crop: c };
}

/** Angle of view in degrees across a given dimension (e.g. the diagonal) for a lens focused at infinity. */
export const angleOfView = (dimension: number, focal: number) => (2 * Math.atan(dimension / (2 * focal)) * 180) / Math.PI;

/** Exposure value at ISO 100: EV = log2(N² / t). */
export const ev = (fNumber: number, seconds: number) => Math.log2((fNumber * fNumber) / seconds);

/** Stops of light difference between two f-numbers (positive = first lets in more light). */
export const stopsBetween = (n1: number, n2: number) => 2 * Math.log2(n2 / n1);

/** Rayleigh's optimal pinhole diameter for screen distance f and wavelength λ (both mm). */
export const rayleighPinhole = (f: number, lambda = 0.00055) => 1.9 * Math.sqrt(f * lambda);

/** Airy disk diameter (to first minimum) in mm: 2.44 λ N. */
export const airyDisk = (fNumber: number, lambda = 0.00055) => 2.44 * lambda * fNumber;

/** Blur of a pinhole image of a distant scene: geometric (≈ d) combined with diffraction (≈ 2.44 λ f / d). */
export function pinholeBlur(d: number, f: number, lambda = 0.00055) {
  const geometric = d;
  const diffraction = (2.44 * lambda * f) / d;
  return { geometric, diffraction, total: Math.hypot(geometric, diffraction) };
}

/** Standard full-stop f-number sequence, rounded the way lenses mark them. */
export const FULL_STOPS = [1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32];
