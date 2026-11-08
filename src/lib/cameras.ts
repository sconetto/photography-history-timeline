/**
 * Camera silhouettes, one per `cameraType`: simple front (or side) views drawn for this site, in a 160 × 100 box.
 * Shapes use `currentColor` for the body and the class `d` for cut-out details (painted in the panel colour by CSS),
 * so they follow the theme. Shared by the entry page (CameraSilhouette.astro) and the timeline hover card.
 */
export const CAMERA_TYPES = ['box', 'folding', 'viewfinder', 'rangefinder', 'tlr', 'slr', 'view', 'instant', 'compact', 'dslr', 'mirrorless', 'phone'] as const;
export type CameraType = (typeof CAMERA_TYPES)[number];

export const CAMERA_NAMES: Record<CameraType, string> = {
  box: 'Box camera',
  folding: 'Folding or press camera',
  viewfinder: 'Viewfinder camera',
  rangefinder: 'Rangefinder camera',
  tlr: 'Twin-lens reflex (TLR)',
  slr: 'Single-lens reflex (SLR)',
  view: 'View camera',
  instant: 'Instant camera',
  compact: 'Compact camera',
  dslr: 'Digital SLR',
  mirrorless: 'Mirrorless camera',
  phone: 'Camera phone',
};

/** concentric lens rings: alternating detail and body, outermost first */
const lens = (cx: number, cy: number, ...r: number[]) => r.map((x, i) => `<circle cx="${cx}" cy="${cy}" r="${x}"${i % 2 === 0 ? ' class="d"' : ''}/>`).join('');
/** a bellows between two vertical spans, with pleat lines */
function bellows(x1: number, t1: number, b1: number, x2: number, t2: number, b2: number, pleats: number) {
  let s = `<path d="M${x1},${t1} L${x2},${t2} V${b2} L${x1},${b1}Z"/>`;
  for (let i = 1; i < pleats; i++) {
    const k = i / pleats, x = x1 + (x2 - x1) * k, t = t1 + (t2 - t1) * k, b = b1 + (b2 - b1) * k;
    s += `<path class="ds" d="M${x},${t} V${b}"/>`;
  }
  return s;
}

const SHAPES: Record<CameraType, string> = {
  box: `<path d="M68,22 Q80,10 92,22" fill="none" stroke="currentColor" stroke-width="3"/><rect x="40" y="22" width="80" height="62" rx="3"/><rect class="d" x="46" y="28" width="11" height="9" rx="1"/><rect class="d" x="103" y="28" width="11" height="9" rx="1"/>${lens(80, 57, 11, 7, 3)}`,
  folding: `<rect x="20" y="22" width="38" height="58" rx="3"/>${bellows(58, 28, 74, 108, 40, 64, 6)}<rect x="56" y="80" width="78" height="5" rx="1"/><rect x="108" y="32" width="9" height="40" rx="1"/><rect x="117" y="43" width="16" height="18" rx="2"/><rect class="d" x="27" y="30" width="12" height="7" rx="1"/>`,
  viewfinder: `<rect x="22" y="34" width="116" height="44" rx="12"/><rect x="32" y="27" width="14" height="8" rx="2"/><rect x="110" y="28" width="18" height="7" rx="2"/><rect class="d" x="56" y="40" width="12" height="8" rx="1"/>${lens(84, 60, 13, 8, 3)}`,
  rangefinder: `<rect x="18" y="26" width="124" height="52" rx="7"/><rect class="d" x="24" y="34" width="17" height="12" rx="1"/><rect class="d" x="60" y="36" width="11" height="8" rx="1"/><rect class="d" x="119" y="34" width="17" height="12" rx="1"/><path class="ds" d="M18,48 H142"/>${lens(80, 60, 17, 12, 6, 2.5)}`,
  tlr: `<path d="M52,4 H108 L112,12 H48Z"/><rect x="46" y="12" width="68" height="84" rx="4"/><rect x="40" y="42" width="6" height="16" rx="1"/>${lens(80, 34, 13, 8, 3)}<rect class="d" x="62" y="50" width="36" height="4" rx="1"/>${lens(80, 72, 15, 10, 4)}`,
  slr: `<path d="M56,40 L63,18 H97 L104,40Z"/><rect x="20" y="40" width="120" height="40" rx="4"/><rect x="30" y="34" width="15" height="6" rx="1"/><rect x="115" y="34" width="15" height="6" rx="1"/><path class="ds" d="M20,52 H60 M100,52 H140"/>${lens(80, 62, 19, 14, 7, 3)}`,
  view: `<rect x="8" y="84" width="144" height="4" rx="1"/><rect x="24" y="16" width="5" height="68" rx="1"/><rect x="29" y="20" width="9" height="62" rx="1"/>${bellows(38, 24, 76, 112, 36, 72, 7)}<rect x="112" y="28" width="9" height="56" rx="1"/><rect x="121" y="46" width="14" height="16" rx="2"/><rect class="d" x="131" y="49" width="4" height="10"/>`,
  instant: `<path d="M28,30 H132 V78 Q132,84 126,84 H34 Q28,84 28,78Z"/><rect class="d" x="96" y="38" width="17" height="11" rx="1"/>${lens(60, 56, 14, 8, 3)}<rect class="d" x="44" y="80" width="72" height="2"/><rect class="d" x="50" y="84" width="60" height="13" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="55" y="86" width="50" height="8" opacity=".35"/>`,
  compact: `<rect x="108" y="25" width="12" height="6" rx="2"/><rect x="26" y="30" width="108" height="52" rx="9"/><rect class="d" x="34" y="38" width="16" height="10" rx="2"/><rect class="d" x="106" y="38" width="20" height="10" rx="2"/>${lens(80, 59, 15, 10, 5, 2)}`,
  dslr: `<path d="M56,40 Q60,16 72,16 H88 Q100,16 104,40Z"/><rect x="16" y="40" width="128" height="44" rx="10"/><rect x="14" y="38" width="28" height="48" rx="11"/><rect x="22" y="33" width="14" height="6" rx="2"/>${lens(84, 64, 22, 16, 9, 4)}`,
  mirrorless: `<path d="M66,42 L70,28 H94 L98,42Z"/><rect x="22" y="42" width="116" height="40" rx="8"/><rect x="20" y="40" width="24" height="44" rx="9"/><rect x="28" y="36" width="12" height="5" rx="2"/>${lens(84, 63, 20, 14, 7, 3)}`,
  phone: `<rect x="52" y="6" width="56" height="88" rx="11"/><rect class="d" x="58" y="12" width="28" height="28" rx="7"/><circle cx="66" cy="20" r="5"/><circle cx="78" cy="20" r="5"/><circle cx="66" cy="32" r="5"/><circle class="d2" cx="66" cy="20" r="2"/><circle class="d2" cx="78" cy="20" r="2"/><circle class="d2" cx="66" cy="32" r="2"/><circle cx="78" cy="32" r="2.2"/>`,
};

/** The silhouette as an SVG string (decorative: the caller supplies the visible label). */
export function cameraSvg(type: CameraType, cls = 'cam') {
  return `<svg class="${cls}" viewBox="0 0 160 100" aria-hidden="true" focusable="false"><g fill="currentColor" stroke="none">${SHAPES[type]}</g></svg>`;
}
