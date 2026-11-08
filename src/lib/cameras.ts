/**
 * Camera drawings: one per camera entry, drawn for this site from reference photographs, in millimetres at the
 * real camera's proportions (front view, or side view for box and bellows cameras). Materials are fixed colours
 * (chrome, leatherette, brass, wood, glass) because they depict objects, like a photograph; a dark outline keeps
 * them readable on the night theme. Entries without their own drawing fall back to a model of the same type.
 * Shared by the entry page (CameraSilhouette.astro) and the timeline hover card.
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

// ---------- materials ----------
const CHROME = 'url(#k-chr)', CHROME2 = 'url(#k-chr2)', LEATHER = 'url(#k-lea)', GREY_LEATHER = 'url(#k-lea-g)', BRASS = 'url(#k-brass)', WOOD = 'url(#k-wood)', WOOD2 = 'url(#k-wood2)', ALU = 'url(#k-alu)', NICKEL = 'url(#k-nick)';
const BLACK = '#1d1c1b', BLACK2 = '#2a2927', DARK = '#121212', WIN = '#1a2128';
const DEFS = `<defs>
<linearGradient id="k-chr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f1"/><stop offset=".45" stop-color="#c5c6c2"/><stop offset=".55" stop-color="#e3e3e0"/><stop offset="1" stop-color="#9c9e9a"/></linearGradient>
<linearGradient id="k-chr2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9dad6"/><stop offset="1" stop-color="#8e908c"/></linearGradient>
<linearGradient id="k-nick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece6d4"/><stop offset=".5" stop-color="#c3bba4"/><stop offset="1" stop-color="#97907b"/></linearGradient>
<linearGradient id="k-alu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e3e4"/><stop offset="1" stop-color="#a9abae"/></linearGradient>
<linearGradient id="k-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d68a"/><stop offset=".5" stop-color="#c79a3c"/><stop offset="1" stop-color="#8d6624"/></linearGradient>
<linearGradient id="k-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9894b"/><stop offset="1" stop-color="#8e5426"/></linearGradient>
<linearGradient id="k-wood2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3743c"/><stop offset="1" stop-color="#7b461f"/></linearGradient>
<radialGradient id="k-glass" cx=".38" cy=".36" r=".7"><stop offset="0" stop-color="#5b7896"/><stop offset=".45" stop-color="#1d2a3b"/><stop offset="1" stop-color="#05080d"/></radialGradient>
<pattern id="k-lea" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><rect width="1.6" height="1.6" fill="#262523"/><circle cx=".5" cy=".6" r=".38" fill="#34322f"/><circle cx="1.25" cy="1.3" r=".3" fill="#1c1b19"/></pattern>
<pattern id="k-lea-g" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><rect width="1.6" height="1.6" fill="#57575a"/><circle cx=".5" cy=".6" r=".38" fill="#6a6a6c"/><circle cx="1.25" cy="1.3" r=".3" fill="#454547"/></pattern>
</defs>`;

// ---------- drawing helpers (all units mm) ----------
const OUT = 'stroke="#000" stroke-opacity=".45" stroke-width=".5"';
const r = (x: number, y: number, w: number, h: number, fill: string, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${OUT}/>`;
const p = (d: string, fill: string) => `<path d="${d}" fill="${fill}" ${OUT}/>`;
const c = (cx: number, cy: number, rad: number, fill: string) => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}" ${OUT}/>`;
/** a knurled knob or dial seen edge-on */
function knurl(x: number, y: number, w: number, h: number, fill = CHROME) {
  let s = r(x, y, w, h, fill, 0.8);
  for (let i = x + 1.1; i < x + w - 0.5; i += 1.3) s += `<line x1="${i.toFixed(1)}" x2="${i.toFixed(1)}" y1="${y + 0.4}" y2="${y + h - 0.4}" stroke="#000" stroke-opacity=".28" stroke-width=".35"/>`;
  return s;
}
/** a window (finder, rangefinder) with a glint */
const win = (x: number, y: number, w: number, h: number, rx = 1) =>
  r(x, y, w, h, WIN, rx) + `<path d="M${x + w * 0.15},${y + h * 0.8} L${x + w * 0.45},${y + h * 0.2}" stroke="#fff" stroke-opacity=".35" stroke-width="${(Math.min(w, h) * 0.12).toFixed(2)}" stroke-linecap="round"/>`;
/** a lens seen from the front: rings from the outside in, then the glass with reflections */
function lens(cx: number, cy: number, rings: [number, string][], glass: number) {
  let s = rings.map(([rad, fill]) => c(cx, cy, rad, fill)).join('');
  const hx = cx - glass * 0.32, hy = cy - glass * 0.34;
  s += `<circle cx="${cx}" cy="${cy}" r="${glass}" fill="url(#k-glass)" stroke="#000" stroke-width=".5"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${glass * 0.62}" fill="none" stroke="#9fc0e0" stroke-opacity=".18" stroke-width="${glass * 0.06}"/>`;
  s += `<ellipse cx="${hx}" cy="${hy}" rx="${glass * 0.3}" ry="${glass * 0.16}" transform="rotate(-38 ${hx} ${hy})" fill="#fff" fill-opacity=".42"/>`;
  s += `<circle cx="${cx + glass * 0.3}" cy="${cy + glass * 0.3}" r="${glass * 0.07}" fill="#fff" fill-opacity=".35"/>`;
  return s;
}
/** a bellows between two vertical edges, with pleats */
function bellows(x1: number, t1: number, b1: number, x2: number, t2: number, b2: number, n: number) {
  let s = p(`M${x1},${t1} L${x2},${t2} V${b2} L${x1},${b1}Z`, '#1f1e1d');
  for (let i = 1; i < n; i++) {
    const k = i / n, x = x1 + (x2 - x1) * k, t = t1 + (t2 - t1) * k, b = b1 + (b2 - b1) * k;
    s += `<path d="M${x.toFixed(1)},${t.toFixed(1)} V${b.toFixed(1)}" stroke="#4a4744" stroke-width=".9"/>`;
  }
  return s;
}
const lugs = (y: number, w: number, fill = CHROME) => r(-1.5, y, 2, 6, fill, 0.5) + r(w - 0.5, y, 2, 6, fill, 0.5);

interface Model { w: number; h: number; view: 'front' | 'side' | 'back'; svg: string }

const MODELS: Record<string, Model> = {
  // ---- SLRs ----
  'nikon-f': { w: 147, h: 99, view: 'front', svg:
    knurl(18, 26, 15, 7) + knurl(112, 25, 16, 8) + r(131, 28, 6, 5, CHROME, 1)
    + p('M40,34 L50,5 Q51,2 54,2 H93 Q96,2 97,5 L107,34Z', CHROME) + p('M53,30 L59,10 H88 L94,30Z', CHROME2)
    + r(2, 33, 143, 15, CHROME, 3) + r(2, 47, 143, 46, LEATHER) + r(2, 92, 143, 7, CHROME, 2) + lugs(37, 147)
    + r(28, 58, 5, 15, CHROME, 1.5)
    + lens(73.5, 64, [[31, CHROME], [29, BLACK], [26.5, BLACK2], [21.5, DARK]], 16) },
  'canon-ae1': { w: 141, h: 88, view: 'front', svg:
    r(60, 0, 21, 4, '#3a3936', 0.6) + p('M42,30 L52,4 H89 L99,30Z', BLACK2) + p('M55,26 L60,10 H81 L86,26Z', '#161514')
    + knurl(16, 23, 16, 5, BLACK2) + knurl(106, 22, 17, 6, BLACK2) + r(126, 24, 6, 4, CHROME, 1)
    + r(2, 28, 137, 12, BLACK2, 3) + r(2, 40, 137, 43, LEATHER) + r(2, 83, 137, 5, BLACK, 2) + lugs(31, 141, BLACK2)
    + r(24, 50, 6, 14, '#333', 1.5)
    + lens(70.5, 60, [[31, CHROME], [29.5, BLACK], [27, '#2f2e2c'], [22, DARK]], 17) },
  'canon-eos': { w: 148, h: 108, view: 'front', svg:
    p('M48,40 Q50,6 64,4 H86 Q100,6 102,40Z', BLACK) + r(106, 30, 30, 7, BLACK2, 2)
    + r(0, 36, 148, 70, BLACK, 10) + r(0, 32, 38, 76, LEATHER, 12)
    + lens(82, 70, [[36, '#1b1a19'], [33, '#2b2a28'], [26, DARK]], 19) },
  'kine-exakta': { w: 150, h: 92, view: 'front', svg:
    p('M58,30 L60,2 H90 L92,30Z', CHROME) + win(66, 8, 18, 11)
    + knurl(8, 22, 18, 8) + knurl(106, 24, 14, 6) + knurl(124, 22, 16, 8)
    + p('M0,30 H150 L147,44 H3Z', CHROME) + p('M3,44 H147 L138,86 H12Z', LEATHER) + p('M12,86 H138 L137,91 H13Z', CHROME)
    + c(20, 54, 2.5, CHROME) + c(20, 64, 2.5, CHROME)
    + lens(70, 62, [[21, CHROME2], [17, CHROME], [14, CHROME2], [10.5, DARK]], 8) },
  'hasselblad-1600f': { w: 110, h: 142, view: 'front', svg:
    r(18, 0, 64, 41, BLACK, 2) + r(22, 4, 56, 33, LEATHER, 1) + r(18, 37, 64, 4, CHROME)
    + r(0, 40, 100, 102, CHROME, 4) + r(6, 46, 88, 90, LEATHER, 2)
    + knurl(100, 64, 10, 26)
    + lens(50, 92, [[33, CHROME], [30, CHROME2], [25, CHROME], [20, DARK]], 15) },
  mavica: { w: 150, h: 120, view: 'front', svg:
    r(56, 0, 40, 46, BLACK, 3) + r(62, 6, 28, 22, '#2c4a46', 2) + r(10, 44, 130, 70, BLACK, 6) + r(0, 44, 30, 76, LEATHER, 8)
    + lens(84, 82, [[26, '#1a1a1a'], [22.5, '#2b2b2b'], [16, DARK]], 12) },
  'kodak-dcs': { w: 148, h: 135, view: 'front', svg:
    p('M46,34 L54,6 H94 L102,34Z', BLACK) + knurl(16, 27, 16, 6, BLACK2) + knurl(110, 26, 18, 7, BLACK2)
    + r(0, 32, 148, 12, BLACK2, 3) + r(0, 44, 148, 52, LEATHER) + r(4, 96, 140, 39, '#2e2e2e', 4) + r(12, 106, 44, 7, '#444', 1)
    + lens(74, 66, [[29, '#1b1b1b'], [26, '#2a2a2a'], [20, DARK]], 15) },
  'nikon-d1': { w: 157, h: 153, view: 'front', svg:
    r(70, 0, 22, 6, '#333', 1) + p('M46,42 L56,10 Q58,6 62,6 H98 Q102,6 104,10 L114,42Z', BLACK) + p('M60,36 L66,14 H94 L100,36Z', BLACK2)
    + r(4, 36, 149, 14, BLACK2, 8) + r(0, 46, 157, 107, BLACK, 12) + r(0, 46, 40, 107, LEATHER, 12) + r(40, 120, 117, 33, LEATHER, 10)
    + r(29, 54, 4, 26, '#b3262a', 2)
    + lens(94, 82, [[36, '#1a1a1a'], [33, '#2a2a2a'], [26, DARK]], 19) },
  // ---- mirrorless ----
  'lumix-g1': { w: 124, h: 84, view: 'front', svg:
    p('M46,30 Q48,2 60,1 H76 Q86,2 88,30Z', BLACK) + knurl(96, 22, 18, 6, BLACK2)
    + r(0, 28, 124, 56, BLACK, 8) + r(0, 26, 32, 58, LEATHER, 10)
    + lens(68, 54, [[30, '#1b1b1b'], [27, '#2b2b2b'], [20, DARK]], 15) },
  'sony-a7': { w: 127, h: 94, view: 'front', svg:
    r(56, 2, 20, 4, '#333', 0.6) + p('M42,30 L50,6 H82 L90,30Z', BLACK) + knurl(94, 20, 16, 8, BLACK2) + knurl(112, 22, 10, 6, BLACK2)
    + r(0, 28, 127, 66, BLACK, 6) + r(0, 24, 34, 70, LEATHER, 8)
    + lens(72, 62, [[31, '#1b1b1b'], [28, '#2b2b2b'], [21, DARK]], 15) },
  // ---- rangefinders and viewfinders ----
  'leica-m3': { w: 138, h: 84, view: 'front', svg:
    knurl(10, 0, 18, 7) + knurl(100, 1, 18, 6) + r(120, 2, 6, 5, CHROME, 1) + r(58, 4, 22, 3, CHROME2)
    + r(0, 7, 138, 28, CHROME, 6) + win(30, 14, 12, 12) + r(52, 15, 15, 10, '#e9e9e5', 1) + win(80, 12, 24, 15, 1.5)
    + r(0, 34, 138, 46, LEATHER) + r(0, 79, 138, 5, CHROME, 2) + lugs(16, 138)
    + r(20, 42, 6, 12, CHROME, 1.5) + c(40, 50, 2.5, CHROME)
    + lens(66, 57, [[23, CHROME], [21, CHROME2], [17, CHROME], [13, DARK]], 10) },
  'argus-c3': { w: 135, h: 88, view: 'front', svg:
    knurl(96, 0, 14, 8) + knurl(114, 2, 14, 6)
    + r(0, 8, 135, 80, LEATHER, 3) + r(0, 8, 135, 4, CHROME, 1) + r(52, 14, 32, 15, CHROME, 1.5) + win(55, 16, 11, 11) + win(70, 16, 11, 11)
    + c(32, 34, 11, CHROME2) + c(32, 34, 8, CHROME) + c(32, 56, 5, CHROME) + r(22, 72, 24, 7, DARK, 1)
    + c(62, 62, 8, '#9a9b97') + c(62, 62, 6, CHROME)
    + lens(88, 56, [[18, CHROME2], [15, CHROME], [11, DARK]], 7.5) },
  'leica-i': { w: 133, h: 76, view: 'front', svg:
    knurl(10, 3, 16, 7, NICKEL) + r(52, 0, 18, 10, BLACK, 1.5) + r(53, 3, 3, 5, NICKEL) + r(66, 3, 3, 5, NICKEL) + knurl(100, 3, 18, 7, NICKEL) + r(122, 5, 5, 5, NICKEL, 1)
    + r(0, 10, 133, 64, BLACK, 9) + r(3, 22, 127, 48, LEATHER, 6)
    + p('M44,54 L36,62 L39,65 L48,57Z', NICKEL)
    + lens(58, 46, [[16, NICKEL], [13, '#b2ab95'], [9.5, DARK]], 7) },
  'fujifilm-x100': { w: 127, h: 80, view: 'front', svg:
    knurl(78, 0, 18, 6) + knurl(100, 1, 14, 5) + r(68, 2, 6, 4, CHROME, 1)
    + r(0, 6, 127, 28, CHROME, 5) + r(88, 10, 30, 20, CHROME2, 2) + win(90, 12, 26, 16, 2) + r(76, 18, 5, 5, '#2a2a2a', 1)
    + r(0, 34, 127, 42, LEATHER) + r(0, 74, 127, 6, CHROME, 3) + lugs(14, 127)
    + lens(54, 48, [[26, '#1a1a1a'], [24, CHROME], [22, '#262626'], [16, DARK]], 12) },
  'olympus-pen': { w: 108, h: 72, view: 'front', svg:
    r(84, 0, 7, 5, CHROME, 1) + r(38, 0, 30, 10, CHROME, 2)
    + r(0, 4, 108, 24, CHROME, 6) + win(44, 8, 18, 13, 2)
    + r(0, 28, 108, 38, GREY_LEATHER) + r(0, 66, 108, 6, CHROME, 3)
    + lens(53, 46, [[16, CHROME], [13, '#1a1a1a'], [9.5, DARK]], 7) },
  instamatic: { w: 120, h: 82, view: 'front', svg:
    r(90, 0, 22, 13, CHROME, 2) + r(93, 2, 16, 9, '#dcdcd6', 1) + r(20, 8, 10, 5, CHROME, 1)
    + r(0, 12, 120, 70, CHROME, 8) + r(8, 20, 104, 54, LEATHER, 6) + win(14, 26, 16, 11, 2)
    + lens(46, 48, [[10, CHROME], [7, DARK]], 5) },
  // ---- twin-lens reflex ----
  rolleiflex: { w: 104, h: 150, view: 'front', svg:
    r(8, 0, 88, 9, BLACK, 2) + r(10, 8, 84, 14, '#1a1a1a', 2)
    + r(4, 22, 96, 124, LEATHER, 4) + r(4, 22, 4, 124, CHROME) + r(96, 22, 4, 124, CHROME)
    + knurl(0, 62, 6, 30) + knurl(98, 70, 6, 16)
    + lens(52, 50, [[19, '#151515'], [17, CHROME], [13, DARK]], 10)
    + r(22, 74, 60, 60, CHROME, 9) + r(28, 78, 12, 5, DARK, 1) + r(64, 78, 12, 5, DARK, 1)
    + lens(52, 106, [[22, CHROME2], [18, CHROME], [13.5, DARK]], 10) },
  // ---- box cameras (side views for the earliest) ----
  brownie: { w: 86, h: 118, view: 'front', svg:
    `<path d="M30,10 Q43,0 56,10" fill="none" stroke="#2a2927" stroke-width="3" stroke-linecap="round"/>`
    + r(0, 8, 86, 110, LEATHER, 2) + r(6, 14, 16, 13, CHROME, 1.5) + win(8, 16, 12, 9) + r(64, 14, 16, 13, CHROME, 1.5) + win(66, 16, 12, 9)
    + lens(43, 64, [[9, CHROME], [6, DARK]], 4) },
  'kodak-camera': { w: 95, h: 86, view: 'front', svg:
    knurl(16, 1, 10, 5, BRASS) + r(64, 0, 6, 6, BRASS, 3)
    + r(0, 6, 95, 80, LEATHER, 2)
    + lens(47.5, 46, [[8, BRASS], [5, DARK]], 3.6) },
  'giroux-camera': { w: 520, h: 270, view: 'side', svg:
    r(330, 10, 186, 250, WOOD2, 3) + r(512, 18, 8, 234, '#3a2a1c', 1)
    + r(58, 0, 290, 270, WOOD, 3) + `<path d="M58,135 H348" stroke="#000" stroke-opacity=".12" stroke-width="1.5"/>`
    + `<ellipse cx="200" cy="96" rx="44" ry="30" fill="${BRASS}" ${OUT}/><ellipse cx="200" cy="96" rx="36" ry="23" fill="#5a3b18" fill-opacity=".35"/>`
    + r(0, 104, 60, 62, BRASS, 4) + r(0, 100, 10, 70, BRASS, 2) + r(22, 104, 4, 62, '#8d6624') },
  'zahn-reflex': { w: 250, h: 150, view: 'side', svg:
    p('M130,42 L140,8 H232 L242,42Z', WOOD2) + r(150, 14, 74, 6, '#2c1e14', 1)
    + r(40, 40, 210, 110, WOOD, 3) + r(0, 76, 44, 38, WOOD2, 2) + r(0, 72, 6, 46, BRASS, 1.5) },
  // ---- folding and press cameras (side views) ----
  'speed-graphic': { w: 280, h: 205, view: 'side', svg:
    r(176, 4, 70, 14, CHROME, 2) + win(232, 7, 10, 8)
    + r(168, 18, 108, 180, LEATHER, 4) + r(186, 70, 70, 18, '#2c2622', 9) + `<path d="M192,79 H250" stroke="#5c5047" stroke-width=".8" stroke-dasharray="2 2"/>`
    + bellows(168, 40, 176, 76, 78, 142, 9)
    + r(30, 190, 146, 8, BLACK, 1) + r(34, 184, 140, 4, CHROME, 1) + c(150, 196, 8, CHROME)
    + r(66, 66, 10, 122, CHROME, 2) + r(58, 72, 10, 76, DARK, 1) + r(40, 84, 20, 52, CHROME2, 3) + r(30, 92, 12, 36, '#1c1c1c', 2) },
  'instant-photography': { w: 285, h: 150, view: 'side', svg:
    r(120, 6, 44, 14, CHROME, 2)
    + r(84, 20, 200, 110, '#4a3a2e', 6) + r(84, 20, 200, 8, CHROME, 3) + r(84, 122, 200, 8, CHROME, 3)
    + bellows(84, 26, 124, 26, 36, 116, 7)
    + r(4, 128, 92, 6, BLACK, 1) + `<path d="M24,128 L84,62 M40,128 L84,92" stroke="#cfcfcb" stroke-width="3" stroke-linecap="round"/>`
    + r(14, 30, 12, 96, CHROME, 2) + r(0, 56, 16, 44, '#1b1b1b', 3) + r(10, 52, 5, 52, CHROME2, 1) },
  'sx-70': { w: 185, h: 112, view: 'side', svg:
    r(10, 86, 175, 24, CHROME, 3) + r(16, 90, 163, 15, '#7a4a2c', 2)
    + p('M12,86 H183 L50,8 H12Z', CHROME) + p('M24,80 H158 L52,20 H24Z', '#7a4a2c')
    + r(8, 0, 46, 11, CHROME, 3) + r(0, 22, 14, 24, '#151515', 2) + r(10, 19, 4, 30, CHROME2, 1) },
  // ---- phones (back views) ----
  iphone: { w: 62, h: 116, view: 'back', svg:
    r(0, 0, 62, 116, ALU, 9) + p('M0,96 H62 V107 Q62,116 53,116 H9 Q0,116 0,107Z', '#1b1b1b')
    + c(11, 10, 4, '#7c7f83') + lens(11, 10, [], 2.8) },
  'camera-phone': { w: 40, h: 150, view: 'back', svg:
    r(26, 0, 8, 26, '#222', 3) + r(0, 20, 40, 130, ALU, 8) + r(4, 104, 32, 40, '#c4c7ca', 5)
    + c(20, 40, 5.5, '#7c7f83') + lens(20, 40, [], 4) + r(8, 50, 24, 8, '#dfe5ea', 1.5) },
};

/** a model of each type, for camera entries without their own drawing */
const TYPE_MODEL: Record<CameraType, string> = {
  box: 'brownie', folding: 'speed-graphic', viewfinder: 'leica-i', rangefinder: 'leica-m3', tlr: 'rolleiflex', slr: 'nikon-f',
  view: 'speed-graphic', instant: 'sx-70', compact: 'olympus-pen', dslr: 'nikon-d1', mirrorless: 'sony-a7', phone: 'iphone',
};

export interface CameraDrawing { svg: string; w: number; h: number; view: Model['view']; own: boolean }

/**
 * The drawing for an entry: its own model if there is one, else a model of its type.
 * The SVG is decorative (the caller supplies the visible label); it is sized at `pxPerMm`, capped at `maxPx` wide.
 */
export function cameraDrawing(entryId: string, type: CameraType, pxPerMm = 1, maxPx = 260): CameraDrawing {
  const own = entryId in MODELS;
  const m = MODELS[own ? entryId : TYPE_MODEL[type]];
  const pad = 2, W = m.w + pad * 2, H = m.h + pad * 2;
  const px = Math.min(maxPx, W * pxPerMm);
  const svg = `<svg class="cam" viewBox="${-pad} ${-pad} ${W} ${H}" width="${px.toFixed(0)}" height="${((px * H) / W).toFixed(0)}" aria-hidden="true" focusable="false">${DEFS}${m.svg}</svg>`;
  return { svg, w: m.w, h: m.h, view: m.view, own };
}

export const CAMERA_MODELS = Object.keys(MODELS);
