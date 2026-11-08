/**
 * Overview navigator: a mini timeline of every entry with a viewfinder window over the part of the chart in view.
 * Drag the window to pan, drag its edges to zoom to a range, drag across the strip to zoom into a period, or tap
 * to centre the window there. Works in axis fractions, the same space as frac() and the main chart.
 */
import { frac, yearAt, SPAN } from '../../lib/scale';
import { useT, docLang, fmtYear as fmtYearIn } from '../../i18n';
const LANG = docLang(), T = useT(LANG), fmtYear = (y: number) => fmtYearIn(LANG, y);
import type { Item, Payload } from './types';

export interface NavState { s: number; k: number; fa: number; fb: number; pick: string | null; sel: string | null; maxK: number }
export interface NavHost {
  state(): NavState;
  /** scroll so that fraction fa is at the left edge */
  pan(fa: number, smooth?: boolean): void;
  /** zoom so that [fa, fb] fills the chart; live = during a drag (rows settle afterwards) */
  zoomRange(fa: number, fb: number, live: boolean): void;
  zoomBy(factor: number): void;
  showAll(): void;
}

const R = { xl: 2.6, l: 2.2, m: 1.8, s: 1.5 } as const;
const OV_TICKS = [-400, 1000, 1500, 1800, 1850, 1900, 1950, 2000];
const PADX = 10, H = 74, AXIS = 33, BAND = 6;
const f1 = (n: number) => n.toFixed(1);
const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

export class Navigator {
  private svg: SVGSVGElement;
  private strip: HTMLElement;
  private win: HTMLElement;
  private shadeL: HTMLElement;
  private shadeR: HTMLElement;
  private brush: HTMLElement;
  private hL: HTMLElement;
  private hR: HTMLElement;
  private readout: HTMLElement;
  private live: HTMLElement;
  private zin: HTMLButtonElement;
  private zout: HTMLButtonElement;
  private all: HTMLButtonElement;
  private width = 0;
  private liveTimer = 0;
  private drawnKey = '';

  constructor(private root: HTMLElement, private data: Payload, private order: Item[], private host: NavHost) {
    const q = <T extends Element>(sel: string) => root.querySelector(sel) as T;
    this.svg = q('svg.ov-svg');
    this.strip = q('.ov');
    this.win = q('.ov-win');
    this.shadeL = q('.ov-shade.l');
    this.shadeR = q('.ov-shade.r');
    this.brush = q('.ov-brush');
    this.hL = q('.ov-h.l');
    this.hR = q('.ov-h.r');
    this.readout = q('.nav-range');
    this.live = q('.nav-live');
    this.zin = q('.nav-in');
    this.zout = q('.nav-out');
    this.all = q('.nav-all');
    this.zin.addEventListener('click', () => host.zoomBy(2));
    this.zout.addEventListener('click', () => host.zoomBy(0.5));
    this.all.addEventListener('click', () => host.showAll());
    const era = q<HTMLSelectElement>('.nav-era');
    era.addEventListener('change', () => {
      const v = era.value;
      era.value = '';
      if (!v) return;
      if (v === 'all') { host.showAll(); return; }
      const [a, b] = v.split(':').map(Number);
      const st = host.state();
      host.zoomRange(frac(a, st.s), frac(Math.min(b, this.data.now + 1), st.s), false);
    });
    this.bindPointer();
    this.bindKeys();
  }

  // ---------- geometry ----------
  private get inner() { return Math.max(1, this.width - 2 * PADX); }
  private xf(f: number) { return PADX + f * this.inner; }
  private fx(clientX: number) { return clamp01((clientX - this.strip.getBoundingClientRect().left - PADX) / this.inner); }

  /** Redraw the overview itself (dots, eras, ticks). Cheap; skipped when nothing it shows has changed. */
  redraw(force = false) {
    const st = this.host.state();
    const w = this.strip.clientWidth;
    const key = `${w}|${st.s}|${st.pick}|${st.sel}`;
    if (!force && key === this.drawnKey) return;
    this.drawnKey = key;
    this.width = w;
    const x = (y: number) => this.xf(frac(y, st.s));
    let html = '';
    this.data.eras.forEach((e, i) => {
      if (i % 2 === 1) html += `<rect class="ov-era" x="${f1(x(e.a))}" y="0" width="${f1(x(Math.min(e.b, SPAN.y1)) - x(e.a))}" height="${H - 14}"/>`;
    });
    html += `<rect class="ov-band" x="${PADX - 3}" y="${AXIS - BAND / 2}" width="${f1(this.inner + 6)}" height="${BAND}" rx="3"/>`;
    // ticks, dropping labels that would collide
    const kept: [number, number][] = [];
    for (const t of OV_TICKS) {
      const label = fmtYear(t), hw = label.length * 3 + 6;
      const tx = Math.min(w - hw + 4, Math.max(hw - 4, x(t)));
      if (kept.some((k) => tx + hw > k[0] && tx - hw < k[1])) continue;
      kept.push([tx - hw, tx + hw]);
      html += `<text class="ov-tick" x="${f1(tx)}" y="${H - 3}" text-anchor="middle">${label}</text>`;
    }
    // every entry as a dot above (discoveries) or below (products) the band, stacked where they crowd
    const rows: Record<'up' | 'down', number[]> = { up: [], down: [] }; // rightmost edge used in each row
    for (const it of this.order) {
      const side = it.side === 'invention' ? 'up' : 'down';
      const r = R[it.impact], cx = x(it.year);
      const used = rows[side];
      let row = used.findIndex((edge) => cx - r >= edge + 0.8);
      if (row < 0) row = used.length < 4 ? used.length : used.indexOf(Math.min(...used));
      used[row] = Math.max(used[row] ?? -Infinity, cx + r);
      const off = BAND / 2 + 3.5 + r + row * 5.4;
      const cy = side === 'up' ? AXIS - off : AXIS + off;
      const dim = st.pick && it.fam !== st.pick ? ' dim' : '';
      html += `<circle class="ov-dot${dim}" cx="${f1(cx)}" cy="${f1(cy)}" r="${r}" style="fill: var(--f-${it.fam})"/>`;
      if (it.id === st.sel) html += `<circle class="ov-sel" cx="${f1(cx)}" cy="${f1(cy)}" r="${r + 2.4}"/>`;
    }
    let last = -Infinity;
    for (const m of this.data.milestones) {
      const mx = Math.max(x(m.year), last + 4); last = mx;
      html += `<path class="ov-gem" d="M${f1(mx)},${AXIS - 2.6} l2.6,2.6 l-2.6,2.6 l-2.6,-2.6z"/>`;
    }
    this.svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
    this.svg.setAttribute('width', String(w));
    this.svg.innerHTML = html;
  }

  /** Move the window and readout to the current visible range. Called on every scroll and zoom frame. */
  update() {
    if (this.strip.clientWidth !== this.width) this.redraw(true);
    const st = this.host.state();
    const a = this.xf(st.fa), b = this.xf(st.fb);
    this.win.style.left = `${a}px`;
    this.win.style.width = `${Math.max(4, b - a)}px`;
    this.shadeL.style.width = `${Math.max(0, a - PADX)}px`;
    this.shadeR.style.left = `${b}px`;
    this.hL.style.left = `${a}px`;
    this.hR.style.left = `${Math.max(b, a + 4)}px`;
    this.shadeR.style.width = `${Math.max(0, this.width - PADX - b)}px`;
    const ya = yearAt(st.fa, st.s), yb = yearAt(st.fb, st.s);
    const yr = (y: number) => (y >= this.data.now ? T('year.today') : fmtYear(Math.round(y)));
    const range = `${yr(ya)} – ${yr(yb)}`;
    const k = st.k < 10 && Math.abs(st.k - Math.round(st.k)) > 0.05 ? st.k.toFixed(1) : String(Math.round(st.k));
    this.readout.textContent = `${range} · ${k}×`;
    const pct = st.fb - st.fa >= 1 ? 0 : Math.round((st.fa / (1 - (st.fb - st.fa))) * 100);
    this.win.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, pct))));
    this.win.setAttribute('aria-valuetext', T('zoom.showing', { a: yr(ya), b: yr(yb) }));
    for (const [h, y] of [[this.hL, ya], [this.hR, yb]] as const) {
      h.setAttribute('aria-valuenow', String(Math.round(y)));
      h.setAttribute('aria-valuetext', yr(y));
    }
    this.zin.disabled = st.k >= st.maxK - 1e-3;
    this.zout.disabled = st.k <= 1 + 1e-3;
    this.all.disabled = this.zout.disabled;
    // announce the range once things settle, not on every frame
    clearTimeout(this.liveTimer);
    this.liveTimer = window.setTimeout(() => { this.live.textContent = T('zoom.live', { range, k }); }, 700);
  }

  // ---------- pointer: pan, resize, brush, tap ----------
  private bindPointer() {
    type Mode = 'pan' | 'left' | 'right' | 'brush';
    let mode: Mode | null = null, startX = 0, startF = 0, grab = 0, moved = false, id = -1;
    const minSpan = () => { const st = this.host.state(); return Math.max(0.002, (st.fb - st.fa) * (st.k / st.maxK)); };
    this.strip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const t = e.target as Element;
      const st = this.host.state();
      startX = e.clientX; startF = this.fx(e.clientX); moved = false; id = e.pointerId;
      if (t.closest('.ov-h.l')) mode = 'left';
      else if (t.closest('.ov-h.r')) mode = 'right';
      // a window that already spans (nearly) everything has nothing to pan, so dragging on it picks a range instead
      else if (t.closest('.ov-win') && st.fb - st.fa < 0.95) { mode = 'pan'; grab = startF - st.fa; }
      else mode = 'brush';
      this.strip.setPointerCapture(e.pointerId);
      this.strip.classList.add('dragging');
      e.preventDefault();
    });
    this.strip.addEventListener('pointermove', (e) => {
      if (!mode || e.pointerId !== id) return;
      if (!moved && Math.abs(e.clientX - startX) < 4) return;
      moved = true;
      const f = this.fx(e.clientX), st = this.host.state();
      if (mode === 'pan') this.host.pan(f - grab);
      else if (mode === 'left') this.host.zoomRange(Math.min(f, st.fb - minSpan()), st.fb, true);
      else if (mode === 'right') this.host.zoomRange(st.fa, Math.max(f, st.fa + minSpan()), true);
      else {
        const a = Math.min(f, startF), b = Math.max(f, startF);
        this.brush.hidden = false;
        this.brush.style.left = `${this.xf(a)}px`;
        this.brush.style.width = `${this.xf(b) - this.xf(a)}px`;
      }
    });
    const end = (e: PointerEvent) => {
      if (!mode || e.pointerId !== id) return;
      const f = this.fx(e.clientX), st = this.host.state();
      if (mode === 'brush') {
        this.brush.hidden = true;
        if (moved && Math.abs(f - startF) > 0.004) this.host.zoomRange(Math.min(f, startF), Math.max(f, startF), false);
        else if (!moved) this.host.pan(f - (st.fb - st.fa) / 2, true); // tap: centre the window here
      }
      mode = null;
      this.strip.classList.remove('dragging');
    };
    this.strip.addEventListener('pointerup', end);
    this.strip.addEventListener('pointercancel', end);
  }

  // ---------- keyboard ----------
  private bindKeys() {
    this.win.addEventListener('keydown', (e) => {
      const st = this.host.state(), w = st.fb - st.fa;
      const to: Record<string, number> = { ArrowLeft: st.fa - w * 0.1, ArrowRight: st.fa + w * 0.1, PageUp: st.fa - w, PageDown: st.fa + w, Home: 0, End: 1 };
      if (e.key in to) { e.preventDefault(); e.stopPropagation(); this.host.pan(to[e.key], true); }
    });
    for (const [h, side] of [[this.hL, 'l'], [this.hR, 'r']] as const) {
      h.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); e.stopPropagation();
        const st = this.host.state(), d = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' ? -1 : 1);
        const min = Math.max(0.002, (st.fb - st.fa) * (st.k / st.maxK));
        if (side === 'l') this.host.zoomRange(clamp01(Math.min(st.fa + d, st.fb - min)), st.fb, false);
        else this.host.zoomRange(st.fa, clamp01(Math.max(st.fb + d, st.fa + min)), false);
      });
    }
  }
}
