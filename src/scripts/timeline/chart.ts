/**
 * Builds and positions one SVG star chart. mode "time": a time band across the middle, discoveries above and
 * products below. mode "lanes": one horizontal lane per family.
 * Stars are SVG <a> links to the entry page; hovering is handled by the caller through callbacks.
 */
import { xOf, SPAN } from '../../lib/scale';
import { useT, docLang, fmtYear as fmtYearIn } from '../../i18n';
const LANG = docLang(), T = useT(LANG), fmtYear = (y: number) => fmtYearIn(LANG, y);
import { zoomGeometry, ticksFor } from '../../lib/zoom';
import { place, type Box } from '../../lib/layout';
import type { Frame, Item, Milestone, Payload, Pos } from './types';

const NS = 'http://www.w3.org/2000/svg';
export const R = { xl: 9, l: 7, m: 5.2, s: 3.8 } as const;
const BAND = 24, BASE = 30, STEP = 32, TOP = 40, BOTPAD = 30;
const LANE_HEAD = 28, LANE_ROW = 32, LANE_PAD = 12, LANE_TOP = 50;
const TICKS = [-400, 1, 500, 1000, 1500, 1700, 1800, 1850, 1900, 1925, 1950, 1975, 2000, 2025];

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(n);
  return n;
}
const f1 = (n: number) => n.toFixed(1);

export interface ItemEls { a: SVGAElement; stem?: SVGLineElement; foot?: SVGCircleElement; halo: SVGCircleElement; ring: SVGCircleElement; dot: SVGCircleElement; text: SVGTextElement; nm: SVGTSpanElement; dt: SVGTSpanElement; hit: SVGRectElement }
export interface Hooks {
  enter(id: string, ev: PointerEvent | FocusEvent, anchor: Element): void;
  leave(id: string): void;
  click(id: string, ev: MouseEvent): void;
  key(id: string, ev: KeyboardEvent): void;
  msEnter(i: number, anchor: Element): void;
  msLeave(): void;
}

export class Chart {
  readonly items: Record<string, ItemEls> = {};
  readonly edges: SVGPathElement[] = [];
  readonly gems: { a: SVGAElement; gem: SVGPathElement; line?: SVGLineElement }[] = [];
  frame: Frame | null = null;
  private g: Record<string, SVGGElement>;
  private edgeList: { from: string; to: string; kind: string }[] = [];
  /** era labels, kept inside the visible part of their band while scrolling */
  private eraLabels: { el: SVGTextElement; a: number; b: number; w: number }[] = [];

  constructor(readonly svg: SVGSVGElement, readonly data: Payload, readonly order: Item[], readonly mode: 'time' | 'lanes', hooks: Hooks) {
    const g = (name: string) => el('g', { class: name }, svg);
    this.g = { bands: g('bands'), lanebg: g('lanebg'), lanelab: g('lanelab'), axis: g('axis'), span: g('span'), ticks: g('ticks'), mil: g('mil'), edges: g('edges'), items: g('items') };
    for (const it of order) for (const p of it.parents) this.edgeList.push({ from: p.id, to: it.id, kind: p.kind });
    for (const e of this.edgeList) this.edges.push(el('path', { class: `edge ${e.kind}`, 'data-from': e.from, 'data-to': e.to }, this.g.edges));
    data.milestones.forEach((m, i) => this.buildGem(m, i, hooks));
    for (const it of order) this.buildItem(it, hooks);
  }

  get edgeData() { return this.edgeList; }

  private buildItem(it: Item, h: Hooks) {
    const a = el('a', { href: it.href, class: `item st-${it.status}`, 'data-id': it.id, 'data-fam': it.fam }, this.g.items);
    // accessible name comes from the visible label and date; the full title and date are the description
    el('title', {}, a).textContent = `${it.title}, ${it.date}`;
    if (this.mode === 'lanes') a.setAttribute('style', `--lc: var(--f-${it.fam})`);
    const o: Partial<ItemEls> = { a };
    if (this.mode === 'time') { o.stem = el('line', { class: 'stem' }, a); o.foot = el('circle', { class: 'foot', r: 1.6 }, a); }
    o.halo = el('circle', { class: 'halo' }, a);
    o.ring = el('circle', { class: 'ring' }, a);
    o.dot = el('circle', { class: 'dot' }, a);
    o.text = el('text', { class: 'lbl' }, a);
    o.nm = el('tspan', { class: 'nm' }, o.text); o.nm.textContent = it.label;
    o.dt = el('tspan', { class: 'dt' }, o.text); o.dt.textContent = ` ${it.ds}`;
    o.hit = el('rect', { class: 'hit' }, a);
    this.items[it.id] = o as ItemEls;
    a.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') h.enter(it.id, ev, o.dot!); });
    a.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') h.leave(it.id); });
    a.addEventListener('focus', (ev) => h.enter(it.id, ev, o.dot!));
    a.addEventListener('blur', () => h.leave(it.id));
    a.addEventListener('click', (ev) => h.click(it.id, ev));
    a.addEventListener('keydown', (ev) => h.key(it.id, ev));
  }

  private buildGem(m: Milestone, i: number, h: Hooks) {
    const a = el('a', { href: m.href, class: 'ms', 'aria-label': T('card.landmarkAria', { when: m.when, label: m.label }) }, this.g.mil);
    const line = this.mode === 'lanes' ? el('line', { class: 'ms-line' }, a) : undefined;
    el('rect', { class: 'ms-hit', width: 18, height: 18 }, a);
    const gem = el('path', { class: 'gem' }, a);
    this.gems.push({ a, gem, line });
    a.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') h.msEnter(i, gem); });
    a.addEventListener('pointerleave', () => h.msLeave());
    a.addEventListener('focus', () => h.msEnter(i, gem));
    a.addEventListener('blur', () => h.msLeave());
  }

  // ---------- layout ----------
  geometry(width: number, s: number, k = 1) {
    return { ...zoomGeometry(width, k), s };
  }
  x(g: { x0: number; mainW: number; s: number }, year: number) { return xOf(year, g.s, g.x0, g.mainW); }

  /** Same rows and label sides, new zoom: used during continuous gestures so labels don't jump between rows. */
  rescale(f: Frame, width: number, k: number): Frame {
    const g = this.geometry(width, f.s, k);
    const pos: Record<string, Pos> = {};
    for (const it of this.order) { const p = f.pos[it.id]; if (p) pos[it.id] = { ...p, x: this.x(g, it.year) }; }
    return { ...f, ...g, pos };
  }

  layout(width: number, s: number, widths: Record<string, number>, k = 1): Frame {
    const g = this.geometry(width, s, k);
    const pos: Record<string, Pos> = {};
    if (this.mode === 'time') {
      const rows: Record<'up' | 'down', Box[][]> = { up: [], down: [] };
      const maxRow = { up: 0, down: 0 };
      for (const it of this.order) {
        const side = it.side === 'invention' ? 'up' : 'down';
        const x = this.x(g, it.year), r = R[it.impact];
        const p = place(rows[side], x, r, widths[it.id] ?? 80, g.W - 8);
        maxRow[side] = Math.max(maxRow[side], p.row);
        pos[it.id] = { x, y: 0, r, anchor: p.anchor, row: p.row, side };
      }
      const upH = BASE + maxRow.up * STEP + 18, downH = BASE + maxRow.down * STEP + 34;
      const axisY = TOP + upH + BAND / 2;
      for (const it of this.order) {
        const p = pos[it.id], off = BAND / 2 + BASE + p.row * STEP;
        p.y = p.side === 'up' ? axisY - off : axisY + off;
      }
      return { ...g, H: axisY + BAND / 2 + downH + BOTPAD, pos, axisY };
    }
    const lanes: { fam: string; top: number; h: number }[] = [];
    let top = LANE_TOP;
    for (const f of this.data.families) {
      const rows: Box[][] = [];
      let maxRow = 0;
      const members = this.order.filter((it) => it.fam === f.id);
      for (const it of members) {
        const x = this.x(g, it.year), r = R[it.impact];
        const p = place(rows, x, r, widths[it.id] ?? 80, g.W - 8);
        maxRow = Math.max(maxRow, p.row);
        pos[it.id] = { x, y: 0, r, anchor: p.anchor, row: p.row };
      }
      const h = LANE_HEAD + (members.length ? maxRow + 1 : 1) * LANE_ROW + LANE_PAD;
      for (const it of members) pos[it.id].y = top + LANE_HEAD + pos[it.id].row * LANE_ROW + 10;
      lanes.push({ fam: f.id, top, h });
      top += h + 4;
    }
    return { ...g, H: top + 10, pos, lanes };
  }

  // ---------- drawing ----------
  draw(f: Frame, measure: (font: string, text: string) => number) {
    this.frame = f;
    const { svg } = this;
    svg.setAttribute('width', String(f.W));
    svg.setAttribute('height', String(Math.round(f.H)));
    svg.setAttribute('viewBox', `0 0 ${f.W} ${Math.round(f.H)}`);
    this.drawEras(f, measure);
    if (this.mode === 'time') this.drawAxis(f, measure); else this.drawLaneChrome(f, measure);
    for (const it of this.order) this.placeItem(it, f);
    this.edges.forEach((p, i) => {
      const e = this.edgeList[i], a = f.pos[e.from], b = f.pos[e.to];
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2;
      p.setAttribute('d', `M${f1(a.x)},${f1(a.y)} C${f1(mx)},${f1(a.y)} ${f1(mx)},${f1(b.y)} ${f1(b.x)},${f1(b.y)}`);
    });
  }

  private drawEras(f: Frame, measure: (font: string, text: string) => number) {
    let html = '';
    const tw = (t: string) => measure('500 10px "IBM Plex Mono"', t.toUpperCase()) + t.length * 1.4;
    const meta: { a: number; b: number; w: number }[] = [];
    this.data.eras.forEach((e, i) => {
      const a = this.x(f, e.a), b = Math.min(this.x(f, e.b), f.x0 + f.mainW + 40);
      if (i % 2 === 1) html += `<rect class="era-band" x="${f1(a)}" y="0" width="${f1(b - a)}" height="${f1(f.H)}"/>`;
      // full name if it fits, else the short name; titles carry the full name and dates either way
      const label = b - a > tw(e.name) + 14 ? e.name : b - a > tw(e.short) + 8 ? e.short : '';
      if (label) {
        html += `<text class="era-name" x="${f1((a + b) / 2)}" y="20" text-anchor="middle"><title>${e.name}, ${e.a < 0 ? T('year.antiquity') : e.a}–${e.b > this.data.now ? T('year.today') : e.b}</title>${label}</text>`;
        meta.push({ a, b, w: tw(label) });
      }
    });
    this.g.bands.innerHTML = html;
    const els = this.g.bands.querySelectorAll<SVGTextElement>('text.era-name');
    this.eraLabels = meta.map((m, i) => ({ ...m, el: els[i] }));
  }

  private ticks(f: Frame, y: number, measure: (font: string, text: string) => number, lines?: [number, number]) {
    let html = '';
    const kept: [number, number][] = [];
    for (const t of ticksFor((y) => this.x(f, y), SPAN.y0, SPAN.y1, TICKS)) {
      const x = this.x(f, t), label = t === 1 ? T('year.ce1') : fmtYear(t);
      const hw = measure('400 10.5px "IBM Plex Mono"', label) / 2 + 8;
      if (kept.some((k) => x + hw > k[0] && x - hw < k[1])) continue;
      kept.push([x - hw, x + hw]);
      if (lines) html += `<line class="tick" x1="${f1(x)}" y1="${lines[0] - 4}" x2="${f1(x)}" y2="${lines[0]}"/><line class="tick" x1="${f1(x)}" y1="${lines[1]}" x2="${f1(x)}" y2="${lines[1] + 4}"/>`;
      html += `<text class="tick-label" x="${f1(x)}" y="${y}" text-anchor="middle">${label}</text>`;
    }
    return html;
  }

  private drawAxis(f: Frame, measure: (font: string, text: string) => number) {
    const ay = f.axisY!, top = ay - BAND / 2, bot = ay + BAND / 2;
    // the band, with a faint sprocket rhythm along its edges
    let html = `<rect class="axis-band" x="${f.x0 - 14}" y="${top}" width="${f1(f.mainW + 56)}" height="${BAND}" rx="5"/>`;
    html += `<line class="sprocket" x1="${f.x0 - 8}" y1="${top + 3.5}" x2="${f1(f.x0 + f.mainW + 36)}" y2="${top + 3.5}"/>`;
    html += `<line class="sprocket" x1="${f.x0 - 8}" y1="${bot - 3.5}" x2="${f1(f.x0 + f.mainW + 36)}" y2="${bot - 3.5}"/>`;
    this.g.axis.innerHTML = html;
    let th = this.ticks(f, ay + 3.8, measure, [top, bot]);
    const nx = this.x(f, this.data.now);
    th += `<path class="now-mark" d="M${f1(nx)},${top - 8} l4,4 l-4,4 l-4,-4z"/><text class="now-label" x="${f1(nx - 8)}" y="${top - 4}" text-anchor="end">${T('year.todayCaps')}</text>`;
    this.g.ticks.innerHTML = th;
    let lastX = -Infinity;
    this.data.milestones.forEach((m, i) => {
      const x = Math.max(this.x(f, m.year), lastX + 11); // keep same-year diamonds apart
      lastX = x;
      this.placeGem(i, x, bot + 13);
    });
  }

  private drawLaneChrome(f: Frame, measure: (font: string, text: string) => number) {
    this.g.ticks.innerHTML = this.ticks(f, 36, measure);
    let lb = '', ll = '';
    for (const ln of f.lanes!) {
      const fam = this.data.families.find((x) => x.id === ln.fam)!;
      const n = this.order.filter((it) => it.fam === ln.fam).length;
      lb += `<rect class="lane-bg" x="8" y="${ln.top}" width="${f.W - 16}" height="${ln.h}" rx="10" style="fill: color-mix(in srgb, var(--f-${ln.fam}) 9%, transparent)"/>`;
      const tw = measure('500 10px "IBM Plex Mono"', fam.name.toUpperCase()) + fam.name.length * 1.3;
      ll += `<circle cx="24" cy="${ln.top + 15}" r="4.5" style="fill: var(--f-${ln.fam})"/>`;
      ll += `<text class="lane-title" x="35" y="${ln.top + 18.5}">${fam.name}</text>`;
      ll += `<text class="lane-count" x="${f1(42 + tw)}" y="${ln.top + 18.5}">${n}</text>`;
    }
    this.g.lanebg.innerHTML = lb;
    this.g.lanelab.innerHTML = ll;
    this.data.milestones.forEach((m, i) => {
      const x = this.x(f, m.year), o = this.gems[i];
      if (o.line) { o.line.setAttribute('x1', f1(x)); o.line.setAttribute('x2', f1(x)); o.line.setAttribute('y1', String(LANE_TOP - 2)); o.line.setAttribute('y2', f1(f.H - 8)); }
      this.placeGem(i, x, LANE_TOP - 6);
    });
  }

  /** Keep labels readable while the chart is scrolled: era names stay inside the visible part of their band,
   *  lane titles stay at the left edge. */
  pin(scrollLeft: number, clientWidth: number) {
    const va = scrollLeft, vb = scrollLeft + clientWidth;
    for (const e of this.eraLabels) {
      const lo = Math.max(e.a, va + 26) + e.w / 2 + 8, hi = Math.min(e.b, vb - 26) - e.w / 2 - 8;
      const x = lo > hi ? (e.a + e.b) / 2 : Math.min(hi, Math.max(lo, (e.a + e.b) / 2));
      e.el.setAttribute('x', f1(x));
    }
    this.g.lanelab.setAttribute('transform', `translate(${f1(scrollLeft)} 0)`);
  }

  private placeGem(i: number, x: number, y: number) {
    const o = this.gems[i];
    o.gem.setAttribute('d', `M${f1(x)},${y - 5} l5,5 l-5,5 l-5,-5z`);
    const hit = o.a.querySelector('.ms-hit')!;
    hit.setAttribute('x', f1(x - 9)); hit.setAttribute('y', String(y - 9));
  }

  private placeItem(it: Item, f: Frame) {
    const o = this.items[it.id], p = f.pos[it.id];
    if (o.stem && o.foot && f.axisY != null) {
      const from = p.side === 'up' ? f.axisY - BAND / 2 : f.axisY + BAND / 2;
      o.stem.setAttribute('x1', f1(p.x)); o.stem.setAttribute('x2', f1(p.x));
      o.stem.setAttribute('y1', f1(from)); o.stem.setAttribute('y2', f1(p.y));
      o.foot.setAttribute('cx', f1(p.x)); o.foot.setAttribute('cy', f1(from));
    }
    for (const c of [o.dot, o.halo, o.ring]) { c.setAttribute('cx', f1(p.x)); c.setAttribute('cy', f1(p.y)); }
    o.dot.setAttribute('r', String(p.r));
    o.ring.setAttribute('r', String(p.r + 3));
    o.halo.setAttribute('r', String(p.r + 5.5));
    const tx = p.anchor === 'start' ? p.x + p.r + 6 : p.x - p.r - 6;
    o.text.setAttribute('text-anchor', p.anchor);
    o.nm.setAttribute('x', f1(tx)); o.nm.setAttribute('y', f1(p.y - 0.5));
    o.dt.setAttribute('x', f1(tx)); o.dt.setAttribute('y', f1(p.y + 11));
    const w = Number(o.a.dataset.w || 80);
    const hx = p.anchor === 'start' ? p.x - p.r - 6 : p.x - p.r - 10 - w;
    o.hit.setAttribute('x', f1(hx)); o.hit.setAttribute('y', f1(p.y - 15));
    o.hit.setAttribute('width', f1(w + 2 * p.r + 18)); o.hit.setAttribute('height', '32');
  }

  /** The selected entry's lifetime on the time band (time mode only). */
  drawSpan(it: Item | undefined) {
    const f = this.frame;
    if (!f || this.mode !== 'time' || f.axisY == null) return;
    const top = f.axisY - BAND / 2;
    let html = '';
    if (it) {
      const a = this.x(f, it.year), b = this.x(f, it.end ?? this.data.now);
      html += `<rect class="span-fill" x="${f1(a)}" y="${top + 2}" width="${f1(Math.max(3, b - a))}" height="${BAND - 4}" rx="4"/>`;
      if (it.range) {
        const ra = this.x(f, it.range[0]), rb = this.x(f, it.range[1]);
        html += `<rect class="span-range" x="${f1(ra)}" y="${top - 3}" width="${f1(Math.max(2, rb - ra))}" height="${BAND + 6}" rx="6"/>`;
      }
    }
    this.g.span.innerHTML = html;
  }
}
