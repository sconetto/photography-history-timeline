/**
 * pnpm links — fetch every external URL in src/content and fail on any that does not load.
 * Wikipedia article names in `wiki:` fields are checked too. Archive.org and Gutenberg pages
 * print their <title> so a human can confirm they are the right item, not a placeholder.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { blocked } from '../src/lib/blocklist.ts';

const ROOT = path.resolve(import.meta.dirname, '..', 'src', 'content');
const CONCURRENCY = 8;
const TIMEOUT = 30_000;
const UA = 'Mozilla/5.0 (compatible; photography-through-time-linkcheck/1.0)';
/** Sites that refuse all automated requests (403 even to a browser user agent). Listed for a manual check; never a failure. */
const MANUAL = ['loc.gov'];
const PLACEHOLDER = /(item not available|page not found|this item is no longer available|no results found)/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(mdx?|ya?ml)$/.test(f) ? [p] : [];
  });
}

const where = new Map<string, Set<string>>();
const add = (url: string, file: string) => {
  let u = url.replace(/[\].,;'"]+$/, '');
  // drop a trailing ")" only when it closes something outside the URL, keeping Flash_(photography)
  while (u.endsWith(')') && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1).replace(/[.,;]+$/, '');
  if (!where.has(u)) where.set(u, new Set());
  where.get(u)!.add(path.relative(ROOT, file));
};
for (const f of files(ROOT)) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>`]+/g)) add(m[0], f);
  const wiki = /^wiki:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(text);
  if (wiki) add(`https://en.wikipedia.org/wiki/${wiki[1]}`, f);
}

type Result = { url: string; ok: boolean; note: string; manual?: boolean };
async function check(url: string): Promise<Result> {
  if (!url.startsWith('https://')) return { url, ok: false, note: 'not https' };
  const bad = blocked(url);
  if (bad) return { url, ok: false, note: `blocked domain (${bad})` };
  const host = new URL(url).hostname;
  if (MANUAL.some((d) => host === d || host.endsWith('.' + d))) return { url, ok: true, manual: true, note: 'blocks automated checks; verify by hand' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
    if (!res.ok) return { url, ok: false, note: `HTTP ${res.status}` };
    let note = `${res.status}`;
    if (/archive\.org|gutenberg\.org/.test(url) && (res.headers.get('content-type') ?? '').includes('html')) {
      const html = await res.text();
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim().replace(/\s+/g, ' ') ?? '(no title)';
      if (PLACEHOLDER.test(title) || PLACEHOLDER.test(html.slice(0, 20_000))) return { url, ok: false, note: `placeholder page: ${title}` };
      note += ` · ${title}`;
    } else {
      await res.body?.cancel();
    }
    return { url, ok: true, note };
  } catch (e) {
    return { url, ok: false, note: ctrl.signal.aborted ? 'timeout' : String((e as Error).cause ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

const urls = [...where.keys()].sort();
const results: Result[] = [];
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < urls.length) {
    const r = await check(urls[next++]);
    results.push(r);
    console.log(`${r.manual ? 'HAND' : r.ok ? 'ok  ' : 'FAIL'} ${r.url}  ${r.note}`);
  }
}));

const failed = results.filter((r) => !r.ok);
const manual = results.filter((r) => r.manual);
console.log(`\n${urls.length} links, ${failed.length} failed, ${manual.length} to verify by hand.`);
for (const r of manual) console.log(`  check by hand: ${r.url}`);
for (const r of failed) console.log(`  ${r.url} — ${r.note}\n    in ${[...where.get(r.url)!].join(', ')}`);
process.exit(failed.length ? 1 : 0);
