/**
 * Home page controller: views (timeline · by family · list), family chips, time scale, hover cards, lineage
 * tracing, hash deep links (#entry-id, #lanes, #list) and touch "first tap previews, second tap opens".
 */
import { Chart, type Hooks } from './chart';
import { lineage } from '../../lib/lineage';
import { frac, yearAt } from '../../lib/scale';
import { clampK, kForRange, scrollFor, visible, ZMAX } from '../../lib/zoom';
import { Navigator } from './navigator';
import type { Frame, Item, Payload } from './types';
import { cameraDrawing } from '../../lib/cameras';

const data = JSON.parse(document.getElementById('timeline-data')!.textContent!) as Payload;
const ORDER = [...data.items].sort((a, b) => a.year - b.year || a.label.localeCompare(b.label));
const BY = new Map(ORDER.map((it) => [it.id, it]));
const FAM = new Map(data.families.map((f) => [f.id, f]));
const nodes = ORDER.map((it) => ({ id: it.id, parents: it.parents }));
const kids = new Map<string, { id: string; kind: string }[]>(ORDER.map((it) => [it.id, []]));
for (const it of ORDER) for (const p of it.parents) kids.get(p.id)?.push({ id: it.id, kind: p.kind });

const $ = <T extends Element>(sel: string) => document.querySelector(sel) as T;
const shell = $<HTMLElement>('#shell');
const scroller = $<HTMLDivElement>('#scroller');
const laneScroller = $<HTMLDivElement>('#lanescroller');
const listWrap = $<HTMLDivElement>('#listwrap');
const card = $<HTMLDivElement>('#card');
const caption = $<HTMLElement>('#caption');
const note = $<HTMLElement>('#scale-note');

function load(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function save(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type View = 'time' | 'lanes' | 'list';
const state = {
  view: 'time' as View,
  s: load('ptt-scale') === '1' ? 1 : 0,
  fam: 'all',
  hoverFam: null as string | null,
  sel: null as string | null,
  armed: null as string | null, // touch: the star whose card is showing; a second tap opens it
  zoom: { k: 1, c: 0.5 },
};
try {
  const z = JSON.parse(sessionStorage.getItem('ptt-zoom') ?? 'null');
  if (z && Number.isFinite(z.k) && Number.isFinite(z.c)) state.zoom = { k: clampK(z.k), c: Math.min(1, Math.max(0, z.c)) };
} catch { /* storage unavailable */ }
const savedView = load('ptt-view');
if (savedView === 'lanes' || savedView === 'list') state.view = savedView;

// ---------- text measurement ----------
const ctx = document.createElement('canvas').getContext('2d')!;
const measure = (font: string, text: string) => { ctx.font = font; return ctx.measureText(text).width; };
const widths: Record<string, number> = {};
function measureAll() {
  for (const it of ORDER) {
    widths[it.id] = Math.ceil(Math.max(measure('500 12.5px "IBM Plex Sans"', it.label), measure('400 10px "IBM Plex Mono"', it.ds)));
  }
  for (const c of [timeChart, laneChart]) for (const it of ORDER) c.items[it.id].a.dataset.w = String(widths[it.id]);
}

// ---------- hover card ----------
let lastPT = 'mouse';
document.addEventListener('pointerdown', (e) => { lastPT = e.pointerType; }, { capture: true });

function placeCard(anchor: Element) {
  const r = anchor.getBoundingClientRect(), sr = shell.getBoundingClientRect();
  const w = card.offsetWidth, h = card.offsetHeight;
  let x = r.right - sr.left + 12, y = r.bottom - sr.top + 10;
  if (x + w > sr.width - 8) x = r.left - sr.left - w - 12;
  if (x < 8) x = 8;
  if (y + h > sr.height - 8) y = r.top - sr.top - h - 10;
  if (y < 8) y = 8;
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
function showCard(it: Item, anchor: Element) {
  const fam = FAM.get(it.fam)!;
  card.innerHTML = '';
  const add = (tag: string, cls: string, text: string) => { const n = document.createElement(tag); n.className = cls; n.textContent = text; card.append(n); return n; };
  if (it.thumb) { const img = document.createElement('img'); img.src = it.thumb; img.alt = it.thumbAlt ?? ''; img.className = 'thumb'; img.width = 280; card.append(img); }
  else if (it.cam) { const c = document.createElement('div'); c.className = 'cam-thumb'; c.innerHTML = cameraDrawing(it.id, it.cam, 0.95, 180).svg; card.append(c); }
  add('strong', 'nm', it.title);
  add('span', 'when', it.date + (it.end ? ` – mainstream until ${it.end}` : ''));
  add('span', 's', it.summary);
  const f = add('span', 'fam', fam.name);
  const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = `var(--f-${it.fam})`; f.prepend(sw);
  add('span', 'today', `Today: ${it.today}`);
  add('span', 'go', lastPT === 'touch' ? 'Tap again to open the entry →' : 'Click to open the entry →');
  card.hidden = false;
  placeCard(anchor);
}
function showGem(i: number, anchor: Element) {
  const m = data.milestones[i];
  card.innerHTML = '';
  const add = (tag: string, cls: string, text: string) => { const n = document.createElement(tag); n.className = cls; n.textContent = text; card.append(n); };
  add('strong', 'nm', m.label); add('span', 'when', `Landmark · ${m.when}`); add('span', 's', m.note);
  card.hidden = false;
  placeCard(anchor);
}
const hideCard = () => { card.hidden = true; };

// ---------- lineage tracing ----------
function trace(id: string) {
  const L = lineage(nodes, id);
  for (const c of [timeChart, laneChart]) {
    c.svg.classList.add('tracing');
    for (const it of ORDER) c.items[it.id].a.classList.toggle('lin', L.up.has(it.id) || L.down.has(it.id));
    c.edges.forEach((p, i) => {
      const e = c.edgeData[i];
      p.classList.toggle('linedge', (L.up.has(e.from) && L.up.has(e.to)) || (L.down.has(e.from) && L.down.has(e.to)));
    });
  }
}
function untrace() { for (const c of [timeChart, laneChart]) c.svg.classList.remove('tracing'); }

// ---------- hooks ----------
const ids = ORDER.map((it) => it.id);
const hooks: Hooks = {
  enter(id, _ev, anchor) {
    if (lastPT === 'touch' && state.armed !== id) return; // touch preview happens on click
    showCard(BY.get(id)!, anchor); trace(id);
  },
  leave() { if (lastPT !== 'touch') { hideCard(); untrace(); } },
  click(id, ev) {
    if (lastPT === 'touch' && state.armed !== id) {
      ev.preventDefault();
      state.armed = id;
      const anchor = (state.view === 'lanes' ? laneChart : timeChart).items[id].dot;
      showCard(BY.get(id)!, anchor); trace(id);
    }
    // otherwise: let the <a> navigate to the entry page
  },
  key(id, ev) {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      const i = (ids.indexOf(id) + (ev.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
      (state.view === 'lanes' ? laneChart : timeChart).items[ids[i]].a.focus();
    }
    if (ev.key === 'Escape') { hideCard(); untrace(); }
  },
  msEnter(i, anchor) { showGem(i, anchor); },
  msLeave() { hideCard(); },
};
document.addEventListener('click', (e) => {
  if (lastPT === 'touch' && !(e.target as Element).closest?.('.item, .ms')) { state.armed = null; hideCard(); untrace(); }
});

const timeChart = new Chart($<SVGSVGElement>('#chart'), data, ORDER, 'time', hooks);
const laneChart = new Chart($<SVGSVGElement>('#lanes-svg'), data, ORDER, 'lanes', hooks);

// ---------- highlight state ----------
const famPick = () => state.hoverFam ?? (state.fam !== 'all' ? state.fam : null);
function applyState() {
  const pick = famPick();
  const sel = state.sel ? BY.get(state.sel) : undefined;
  const rel = new Set<string>();
  if (sel) { sel.parents.forEach((p) => rel.add(p.id)); kids.get(sel.id)?.forEach((k) => rel.add(k.id)); }
  for (const c of [timeChart, laneChart]) {
    c.svg.classList.toggle('picking', !!pick);
    c.svg.style.setProperty('--pick', pick ? `var(--f-${pick})` : 'transparent');
    for (const it of ORDER) {
      const cl = c.items[it.id].a.classList;
      cl.toggle('dim', state.fam !== 'all' && it.fam !== state.fam && it.id !== state.sel);
      cl.toggle('predim', state.fam === 'all' && !!state.hoverFam && it.fam !== state.hoverFam && it.id !== state.sel);
      cl.toggle('inpick', !!pick && it.fam === pick);
      cl.toggle('sel', it.id === state.sel);
      cl.toggle('rel', rel.has(it.id));
    }
    c.edges.forEach((p, i) => {
      const e = c.edgeData[i];
      const hot = !!state.sel && (e.from === state.sel || e.to === state.sel);
      const famEdge = state.fam !== 'all' && BY.get(e.from)!.fam === state.fam && BY.get(e.to)!.fam === state.fam;
      p.classList.toggle('hot', hot);
      p.classList.toggle('fam', !hot && famEdge);
      p.classList.toggle('cold', !hot && !famEdge && state.fam !== 'all');
    });
  }
  timeChart.drawSpan(sel);
  nav.redraw();
  document.querySelectorAll<HTMLButtonElement>('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fam === state.fam ? 'true' : 'false'));
  document.querySelectorAll<HTMLTableRowElement>('#tbody tr').forEach((tr) => { tr.hidden = state.fam !== 'all' && tr.dataset.fam !== state.fam; });
}

// ---------- drawing, zoom, scale and views ----------
// Zoom is semantic: the chart is laid out k times wider and scrolled. state.zoom.c is the axis fraction at the
// centre of the view, kept across redraws, view switches and scale changes; it lives in sessionStorage so Back
// from an entry page returns to the same range.
const active = () => (state.view === 'lanes' ? { c: laneChart, sc: laneScroller } : { c: timeChart, sc: scroller });
const vw = (sc: HTMLElement) => sc.clientWidth || shell.clientWidth;
function layoutFor(c: Chart, sc: HTMLElement, k = state.zoom.k, s = state.s) { return c.layout(vw(sc), s, widths, k); }
const centreFrac = (f: Frame, sc: HTMLElement) => (sc.scrollLeft + vw(sc) / 2 - f.x0) / f.mainW;
type Place = (f: Frame, e: number) => number;
const atCentre = (cf: number): Place => (f) => scrollFor(cf, vw(active().sc) / 2, f.x0, f.mainW);

/** Draw a frame, scroll it, and bring the pinned labels, edge fades and navigator along. */
function show(c: Chart, sc: HTMLElement, f: Frame, left: number) {
  c.draw(f, measure);
  sc.scrollLeft = left;
  if (c === timeChart) timeChart.drawSpan(state.sel ? BY.get(state.sel) : undefined);
  syncScroll();
}
function drawTime() { const f = layoutFor(timeChart, scroller); show(timeChart, scroller, f, atCentre(state.zoom.c)(f, 1)); }
function drawLanes() { const f = layoutFor(laneChart, laneScroller); show(laneChart, laneScroller, f, atCentre(state.zoom.c)(f, 1)); }
function relayout() {
  measureAll();
  if (state.view === 'lanes') drawLanes(); else if (state.view === 'time') drawTime();
  applyState();
}

let anim = 0;
/** Tween between two frames: widths on a log scale (zoom feels even), fractions and rows linearly. */
function tween(c: Chart, sc: HTMLElement, A: Frame, B: Frame, place: Place, dur = 520) {
  cancelAnimationFrame(anim);
  if (reduced()) { show(c, sc, B, place(B, 1)); applyState(); persistZoom(); return; }
  const fr = (f: Frame, id: string) => (f.pos[id].x - f.x0) / f.mainW;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const mainW = Math.exp(Math.log(A.mainW) + (Math.log(B.mainW) - Math.log(A.mainW)) * e);
    const pos: Frame['pos'] = {};
    for (const it of ORDER) {
      const a = A.pos[it.id], b = B.pos[it.id];
      pos[it.id] = { ...b, x: B.x0 + (fr(A, it.id) + (fr(B, it.id) - fr(A, it.id)) * e) * mainW, y: a.y + (b.y - a.y) * e, anchor: e < 0.5 ? a.anchor : b.anchor };
    }
    const F: Frame = {
      ...B, mainW, W: mainW + (B.W - B.mainW), s: A.s + (B.s - A.s) * e, k: A.k + (B.k - A.k) * e, pos, H: A.H + (B.H - A.H) * e,
      axisY: A.axisY != null && B.axisY != null ? A.axisY + (B.axisY - A.axisY) * e : B.axisY,
    };
    if (t < 1) { show(c, sc, F, place(F, e)); anim = requestAnimationFrame(step); }
    else { show(c, sc, B, place(B, 1)); applyState(); persistZoom(); }
  };
  anim = requestAnimationFrame(step);
}

let settleTimer = 0;
/**
 * Change the zoom. "animate" tweens to a full re-layout; "live" (pinch, ctrl-wheel, dragging a navigator edge)
 * only stretches x and keeps label rows, then settles the rows once the gesture pauses.
 */
function zoomTo(k: number, place: Place, mode: 'animate' | 'live') {
  if (state.view === 'list') return;
  const { c, sc } = active();
  const A = c.frame;
  if (!A) return;
  k = clampK(k);
  hideCard(); untrace(); state.armed = null;
  state.zoom.k = k;
  if (mode === 'live') {
    cancelAnimationFrame(anim);
    const F = c.rescale(A, vw(sc), k);
    show(c, sc, F, place(F, 1));
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const cur = c.frame!, B = layoutFor(c, sc, k), left = sc.scrollLeft;
      tween(c, sc, cur, B, () => left, 220);
    }, 160);
    return;
  }
  clearTimeout(settleTimer);
  tween(c, sc, A, layoutFor(c, sc, k), place);
}
/** Zoom keeping the axis point under viewport x px where it is. */
function zoomAbout(k: number, px: number, mode: 'animate' | 'live') {
  const { c, sc } = active();
  if (!c.frame) return;
  const f = (sc.scrollLeft + px - c.frame.x0) / c.frame.mainW;
  zoomTo(k, (F) => scrollFor(f, px, F.x0, F.mainW), mode);
}
/** Zoom so the fraction range [fa, fb] fills the chart, gliding the centre there. */
function zoomRange(fa: number, fb: number, live: boolean) {
  const { c, sc } = active();
  if (!c.frame) return;
  const pad = live ? 0 : (fb - fa) * 0.03;
  const k = kForRange(fa - pad, fb + pad, vw(sc));
  const c0 = centreFrac(c.frame, sc), c1 = (fa + fb) / 2;
  zoomTo(k, (F, e) => atCentre(c0 + (c1 - c0) * e)(F, e), live ? 'live' : 'animate');
}
const showAll = () => { const { c, sc } = active(); if (c.frame) zoomTo(1, atCentre(c.frame ? centreFrac(c.frame, sc) : 0.5), 'animate'); };

function syncScroll() {
  const { c, sc } = active();
  const f = c.frame;
  if (!f || state.view === 'list') return;
  c.pin(sc.scrollLeft, vw(sc));
  const max = sc.scrollWidth - sc.clientWidth;
  sc.classList.toggle('more-l', sc.scrollLeft > 2);
  sc.classList.toggle('more-r', sc.scrollLeft < max - 2);
  sc.classList.toggle('can-pan', max > 2);
  nav.update();
}
let persistTimer = 0;
function persistZoom() {
  const { c, sc } = active();
  if (c.frame && state.view !== 'list') state.zoom.c = centreFrac(c.frame, sc);
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => { try { sessionStorage.setItem('ptt-zoom', JSON.stringify(state.zoom)); } catch { /* storage unavailable */ } }, 200);
}

function setScale(s: number) {
  if (s === state.s) return;
  const prev = state.s;
  state.s = s;
  save('ptt-scale', String(s));
  syncScaleButtons();
  setNote();
  if (state.view === 'list') return;
  const { c, sc } = active();
  const A = c.frame;
  if (!A) return;
  // keep the year at the centre of the view in the centre while the scale changes
  const year = yearAt(centreFrac(A, sc), prev);
  const B = layoutFor(c, sc);
  tween(c, sc, A, B, (F) => F.x0 + frac(year, F.s) * F.mainW - vw(sc) / 2, 650);
}
function syncScaleButtons() {
  $<HTMLButtonElement>('#sc-stretch').setAttribute('aria-pressed', state.s === 0 ? 'true' : 'false');
  $<HTMLButtonElement>('#sc-true').setAttribute('aria-pressed', state.s === 1 ? 'true' : 'false');
}
function setNote() {
  note.textContent = state.view === 'lanes'
    ? 'One lane per family, in its own colour. Hover a star to light up everything it built on and everything built on it.'
    : state.s === 0
      ? 'Time is stretched toward the present, so the crowded last two centuries have room. Photography itself is less than 200 years old.'
      : 'True to time: every century gets the same width. Photography occupies only the last sliver of the dark box’s 2,400-year story.';
}
function setView(v: View, persist = true) {
  cancelAnimationFrame(anim);
  state.view = v;
  if (persist) save('ptt-view', v);
  (['time', 'lanes', 'list'] as View[]).forEach((k) => $<HTMLButtonElement>(`#v-${k}`).setAttribute('aria-pressed', k === v ? 'true' : 'false'));
  scroller.hidden = v !== 'time';
  laneScroller.hidden = v !== 'lanes';
  listWrap.hidden = v !== 'list';
  caption.hidden = v === 'list';
  navEl.hidden = v === 'list';
  $<HTMLElement>('#legend').hidden = v === 'list';
  navEl.querySelector('.ov-win')!.setAttribute('aria-controls', v === 'lanes' ? 'lanescroller' : 'scroller');
  hideCard(); untrace();
  if (v === 'time') drawTime();
  if (v === 'lanes') drawLanes();
  setNote();
  applyState();
  requestAnimationFrame(() => { if (state.sel) focusOn(state.sel, false); });
}
function focusOn(id: string, smooth = true) {
  const sc = state.view === 'lanes' ? laneScroller : state.view === 'time' ? scroller : null;
  const fr = state.view === 'lanes' ? laneChart.frame : timeChart.frame;
  if (!sc || !fr || !fr.pos[id]) return;
  const p = fr.pos[id];
  if (p.x < sc.scrollLeft + 60 || p.x > sc.scrollLeft + sc.clientWidth - 60) {
    sc.scrollTo({ left: Math.max(0, p.x - sc.clientWidth / 2), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }
}

// ---------- navigator ----------
const navEl = $<HTMLElement>('#nav');
const nav = new Navigator(navEl, data, ORDER, {
  state() {
    const { c, sc } = active();
    const f = c.frame;
    const [fa, fb] = f ? visible(sc.scrollLeft, vw(sc), f.x0, f.mainW) : [0, 1];
    return { s: state.s, k: f?.k ?? state.zoom.k, fa, fb, pick: famPick(), sel: state.sel, maxK: ZMAX };
  },
  pan(fa, smooth) {
    const { c, sc } = active();
    if (!c.frame) return;
    sc.scrollTo({ left: c.frame.x0 + fa * c.frame.mainW, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  },
  zoomRange,
  zoomBy(factor) { const { sc } = active(); zoomAbout(state.zoom.k * factor, vw(sc) / 2, 'animate'); },
  showAll,
});

// ---------- chart gestures: ctrl/⌘-wheel or pinch to zoom, drag empty space to pan ----------
for (const sc of [scroller, laneScroller]) {
  sc.addEventListener('scroll', () => { syncScroll(); persistZoom(); }, { passive: true });
  sc.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // plain wheel scrolls the page; sideways wheel pans natively
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 0.05 : 0.0025;
    zoomAbout(state.zoom.k * Math.exp(-e.deltaY * scale), e.clientX - sc.getBoundingClientRect().left, 'live');
  }, { passive: false });
  let drag: { x: number; left: number; id: number; moved: boolean } | null = null;
  sc.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('a')) return;
    if (sc.scrollWidth <= sc.clientWidth + 2) return;
    drag = { x: e.clientX, left: sc.scrollLeft, id: e.pointerId, moved: false };
  });
  sc.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return;
    if (!drag.moved) { drag.moved = true; sc.setPointerCapture(e.pointerId); sc.classList.add('panning'); }
    sc.scrollLeft = drag.left - (e.clientX - drag.x);
  });
  const end = () => {
    if (drag?.moved) sc.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
    drag = null;
    sc.classList.remove('panning');
  };
  sc.addEventListener('pointerup', end);
  sc.addEventListener('pointercancel', end);
}
// + / − / 0 while focus is anywhere in the chart (stars, navigator)
shell.addEventListener('keydown', (e) => {
  if (state.view === 'list' || e.ctrlKey || e.metaKey || e.altKey || (e.target as Element).closest('input, select, textarea')) return;
  const { sc } = active();
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAbout(state.zoom.k * 2, vw(sc) / 2, 'animate'); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAbout(state.zoom.k / 2, vw(sc) / 2, 'animate'); }
  else if (e.key === '0') { e.preventDefault(); showAll(); }
});

// ---------- controls ----------
document.querySelectorAll<HTMLButtonElement>('#chips .chip').forEach((b) => {
  const fam = b.dataset.fam!;
  b.addEventListener('click', () => { state.fam = state.fam === fam && fam !== 'all' ? 'all' : fam; state.hoverFam = null; applyState(); });
  if (fam !== 'all') {
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { state.hoverFam = fam; applyState(); } });
    b.addEventListener('pointerleave', () => { if (state.hoverFam) { state.hoverFam = null; applyState(); } });
  }
});
$<HTMLButtonElement>('#sc-stretch').addEventListener('click', () => setScale(0));
$<HTMLButtonElement>('#sc-true').addEventListener('click', () => setScale(1));
(['time', 'lanes', 'list'] as View[]).forEach((k) => $<HTMLButtonElement>(`#v-${k}`).addEventListener('click', () => { setView(k); history.replaceState(null, '', k === 'time' ? location.pathname : `#${k}`); }));

// ---------- hash routes ----------
function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'lanes' || h === 'list' || h === 'timeline') { setView(h === 'timeline' ? 'time' : h, false); return; }
  if (BY.has(h)) {
    state.sel = h;
    if (state.view === 'list') setView('time', false);
    applyState();
    requestAnimationFrame(() => {
      focusOn(h, false);
      const c = state.view === 'lanes' ? laneChart : timeChart;
      shell.scrollIntoView({ block: 'nearest' });
      c.items[h].a.focus({ preventScroll: true });
    });
  }
}
window.addEventListener('hashchange', readHash);

// ---------- boot ----------
document.documentElement.classList.add('js');
syncScaleButtons();
measureAll();
setView(state.view, false);
readHash();
document.fonts?.ready.then(() => relayout());
let lastW = shell.clientWidth;
new ResizeObserver(() => { const w = shell.clientWidth; if (Math.abs(w - lastW) > 4) { lastW = w; relayout(); } }).observe(shell);
