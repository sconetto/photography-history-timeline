// Hover/focus popover for [[g:term]] links. The link still goes to /glossary/#term when clicked.
const data = JSON.parse(document.getElementById('gloss-data')?.textContent || '{}') as Record<string, { t: string; d: string }>;
const pop = document.getElementById('gloss-pop') as HTMLDivElement | null;

function show(a: HTMLElement) {
  const g = data[a.dataset.term || ''];
  if (!g || !pop) return;
  pop.innerHTML = '';
  const s = document.createElement('strong');
  s.textContent = g.t;
  pop.append(s, document.createTextNode(g.d));
  pop.hidden = false;
  const r = a.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let x = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  let y = r.bottom + 8;
  if (y + h > window.innerHeight - 8) y = r.top - h - 8;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
}
const hide = () => { if (pop) pop.hidden = true; };
document.addEventListener('pointerover', (e) => { const a = (e.target as Element).closest?.('a.gloss') as HTMLElement | null; if (a) show(a); });
document.addEventListener('pointerout', (e) => { if ((e.target as Element).closest?.('a.gloss')) hide(); });
document.addEventListener('focusin', (e) => { const a = (e.target as Element).closest?.('a.gloss') as HTMLElement | null; if (a) show(a); else hide(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
window.addEventListener('scroll', hide, { passive: true });
