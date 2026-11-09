/**
 * pnpm wiki:langlinks [lang] [--write] — find the other-language Wikipedia article for each entry and maker.
 *
 * A translation links to its own Wikipedia only when we know it is the same article:
 *  1. the English `wiki:` title is resolved as Wikipedia does (normalisation and redirects);
 *  2. its interlanguage link to that language is taken (set through the shared Wikidata item, not by title);
 *  3. the other-language article must link back to the same English article, and must not be a redirect
 *     or a disambiguation page;
 *  4. English links that land on a section of a broader article are skipped (the counterpart would be the
 *     whole article).
 *
 * Without --write it only reports. With --write it adds `wiki:` to translation files that have none.
 * Translations that already set `wiki:` are checked too, and reported if they no longer match.
 * Exits non-zero if an existing `wiki:` no longer matches.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const LANG = args.find((a) => !a.startsWith('--')) ?? 'pt-br';
const WRITE = args.includes('--write');
const WIKI_LANG = LANG.split('-')[0];
const CONTENT = path.resolve(import.meta.dirname, '..', 'src', 'content');
// Wikipedia asks automated clients for a descriptive user agent with a way to reach the operator.
const UA = 'photography-through-time-wikilinks/1.0 (+https://github.com/sconetto/photography-history-timeline)';

type Rec = { kind: 'entries' | 'makers'; id: string; wiki: string; file: string; current?: string };
type Page = { title: string; missing?: boolean; invalid?: boolean; langlinks?: { lang: string; title: string }[]; pageprops?: Record<string, string> };
type Query = { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string; tofragment?: string }[]; pages: Page[] };

const WIKI_FIELD = /^wiki:\s*["']?([^"'\n]+?)["']?\s*$/m;
const title = (w: string) => decodeURIComponent(w).replace(/_/g, ' ');

const recs: Rec[] = [];
for (const [kind, ext] of [['entries', '.mdx'], ['makers', '.md']] as const) {
  for (const f of readdirSync(path.join(CONTENT, kind)).filter((f) => f.endsWith(ext))) {
    const id = f.slice(0, -ext.length);
    const wiki = WIKI_FIELD.exec(readFileSync(path.join(CONTENT, kind, f), 'utf8'))?.[1];
    const file = path.join(CONTENT, 'i18n', LANG, kind, f);
    if (!wiki || !existsSync(file)) continue;
    const head = readFileSync(file, 'utf8').split('\n---', 2)[0];
    recs.push({ kind, id, wiki, file, current: WIKI_FIELD.exec(head)?.[1] });
  }
}

async function api(host: string, params: Record<string, string>): Promise<Query> {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.status === 429 || res.status === 503) { await new Promise((r) => setTimeout(r, 3000 * (i + 1))); continue; }
    if (!res.ok) throw new Error(`${host}: HTTP ${res.status}`);
    return ((await res.json()) as { query: Query }).query;
  }
  throw new Error(`${host}: rate limited`);
}
const hop = (t: string, list?: { from: string; to: string }[]) => list?.find((m) => m.from === t)?.to ?? t;

// 1. English → other language
const fwd = new Map<string, { enTitle: string; fragment?: string; missing: boolean; other?: string }>();
for (let i = 0; i < recs.length; i += 50) {
  const batch = recs.slice(i, i + 50);
  const q = await api('en.wikipedia.org', { action: 'query', prop: 'langlinks', lllang: WIKI_LANG, lllimit: 'max', redirects: '1', titles: batch.map((r) => title(r.wiki).split('#')[0]).join('|') });
  for (const r of batch) {
    const [t0, frag0] = title(r.wiki).split('#');
    let t = hop(t0, q.normalized);
    let fragment: string | undefined = frag0;
    const red = q.redirects?.find((m) => m.from === t);
    if (red) { t = red.to; fragment ??= red.tofragment; }
    const p = q.pages.find((p) => p.title === t);
    fwd.set(r.wiki, { enTitle: t, fragment, missing: !p || !!p.missing || !!p.invalid, other: p?.langlinks?.[0]?.title });
  }
}

// 2. Other language → English, for every candidate and every title already in use
const candidates = [...new Set([...[...fwd.values()].map((v) => v.other), ...recs.map((r) => r.current && title(r.current))].filter((t): t is string => !!t))];
const back = new Map<string, { title?: string; redirected: boolean; disambig: boolean; missing: boolean; en?: string }>();
for (let i = 0; i < candidates.length; i += 50) {
  const batch = candidates.slice(i, i + 50);
  const q = await api(`${WIKI_LANG}.wikipedia.org`, { action: 'query', prop: 'langlinks|pageprops', ppprop: 'disambiguation', lllang: 'en', lllimit: 'max', redirects: '1', titles: batch.join('|') });
  for (const t0 of batch) {
    const t = hop(t0, q.normalized);
    const red = q.redirects?.find((m) => m.from === t);
    const p = q.pages.find((p) => p.title === (red?.to ?? t));
    back.set(t0, { title: p?.title, redirected: !!red, disambig: !!p?.pageprops && 'disambiguation' in p.pageprops, missing: !p || !!p.missing, en: p?.langlinks?.[0]?.title });
  }
}

/** Why `other` is not a sure counterpart of the English article, or '' when it is. */
function problem(enTitle: string, other: string): string {
  const b = back.get(other);
  if (!b || b.missing) return `${WIKI_LANG} article "${other}" does not exist`;
  if (b.redirected) return `${WIKI_LANG} title "${other}" redirects to "${b.title}"`;
  if (b.disambig) return `${WIKI_LANG} article "${other}" is a disambiguation page`;
  if (b.en !== enTitle) return `${WIKI_LANG} article "${other}" links back to "${b.en ?? 'nothing'}", not "${enTitle}"`;
  return '';
}

let added = 0, kept = 0, broken = 0;
const skipped: string[] = [];
for (const r of recs) {
  const f = fwd.get(r.wiki)!;
  const name = `${r.kind}/${r.id}`;
  if (r.current) {
    const why = f.missing ? `English article "${r.wiki}" is missing` : problem(f.enTitle, title(r.current));
    if (why) { broken++; console.log(`BROKEN ${name}: wiki "${r.current}" — ${why}`); } else kept++;
    continue;
  }
  const why = f.missing ? 'English article missing'
    : f.fragment ? `English link lands on section "${f.fragment}" of ${f.enTitle}`
    : !f.other ? `no ${WIKI_LANG} article linked`
    : problem(f.enTitle, f.other);
  if (why) { skipped.push(`${name} — ${why}`); continue; }
  console.log(`${WRITE ? 'ADD ' : 'CAN ADD'} ${name}: ${f.enTitle} → ${f.other}`);
  if (WRITE) {
    const s = readFileSync(r.file, 'utf8');
    const end = s.indexOf('\n---', 4);
    writeFileSync(r.file, `${s.slice(0, end)}\nwiki: "${f.other!.replace(/ /g, '_').replace(/"/g, '\\"')}"${s.slice(end)}`);
  }
  added++;
}
for (const s of skipped) console.log(`skip ${s}`);
console.log(`\n${LANG}: ${kept} confirmed, ${added} ${WRITE ? 'added' : 'can be added (run with --write)'}, ${skipped.length} kept in English, ${broken} broken.`);
process.exit(broken ? 1 : 0);
