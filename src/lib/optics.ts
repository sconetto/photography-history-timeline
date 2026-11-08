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

/** Exposure value of a setting, referred to ISO 100: EV100 = log2(N² / t) − log2(ISO / 100). */
export const ev100 = (fNumber: number, seconds: number, iso: number) => ev(fNumber, seconds) - Math.log2(iso / 100);

/** Thin lens: image distance v for focal length f and subject distance u (1/f = 1/u + 1/v), and magnification. */
export function thinLens(f: number, u: number) {
  if (u <= f) return { v: Infinity, m: Infinity };
  const v = (f * u) / (u - f);
  return { v, m: v / u };
}

/** Hyperfocal distance (mm) for focal length f, f-number N and circle of confusion c (mm). */
export const hyperfocal = (f: number, N: number, c = 0.03) => (f * f) / (N * c) + f;

/** Near and far limits of acceptable sharpness (mm) for a subject at distance s (mm). far = Infinity past the hyperfocal. */
export function depthOfField(f: number, N: number, s: number, c = 0.03) {
  const H = hyperfocal(f, N, c);
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  return { near, far, total: far - near, H };
}

/** Lens diameter (entrance pupil) for a focal length and f-number: D = f / N. */
export const pupil = (f: number, N: number) => f / N;

/** Light gathered relative to f/1 (∝ 1/N²). */
export const relativeLight = (N: number) => 1 / (N * N);

/**
 * Approximate sRGB colour of a black body at temperature K (1000–40000), as [r, g, b] 0–255.
 * A widely used curve fit to the CIE data (after Tanner Helland); good enough for illustration, not colorimetry.
 */
export function kelvinRgb(K: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, K)) / 100;
  const c = (x: number) => Math.round(Math.min(255, Math.max(0, x)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}

/** Signal-to-noise ratio when averaging n frames that each collect `photons` photons: shot noise only. */
export const stackedSnr = (photons: number, n: number) => Math.sqrt(photons * n);
