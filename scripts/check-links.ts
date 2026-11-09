/**
 * pnpm links — fetch every external URL in src/content and fail on any that does not load.
 * Wikipedia article names in `wiki:` fields are checked too. Archive.org and Gutenberg pages
 * print their <title> so a human can confirm they are the right item, not a placeholder.
 * English Wikipedia articles are checked in batches through the MediaWiki API (one request per 50 titles),
 * because fetching each page trips Wikipedia's rate limit (HTTP 429).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { blocked } from '../src/lib/blocklist.ts';

const ROOT = path.resolve(import.meta.dirname, '..', 'src', 'content');
const CONCURRENCY = 8;
const TIMEOUT = 30_000;
// Wikipedia asks automated clients for a descriptive user agent with a way to reach the operator.
const UA = 'photography-through-time-linkcheck/1.1 (+https://github.com/sconetto/photography-history-timeline)';
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

/** fetch with retries on 429/503, honouring Retry-After (capped), with a timeout per attempt. */
async function get(url: string, tries = 4): Promise<Response> {
  for (let i = 0; ; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/json,*/*' } });
      if ((res.status === 429 || res.status === 503) && i < tries - 1) {
        await res.body?.cancel();
        const wait = Math.min(Number(res.headers.get('retry-after')) || 2 ** i * 2, 30);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      return res;
    } catch (e) {
      if (ctrl.signal.aborted) throw new Error('timeout');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}

const WIKI = /^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/;
/** Check English Wikipedia articles 50 at a time. Redirects and normalised titles count as found. */
async function checkWikipedia(list: string[]): Promise<Result[]> {
  const out: Result[] = [];
  const title = (u: string) => decodeURIComponent(WIKI.exec(u)![1].split('#')[0]).replace(/_/g, ' ');
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.map(title).join('|'))}`;
    try {
      const res = await get(api);
      if (!res.ok) { for (const url of batch) out.push({ url, ok: false, note: `Wikipedia API HTTP ${res.status}` }); continue; }
      const q = (await res.json()).query as { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages: { title: string; missing?: boolean; invalid?: boolean }[] };
      const hop = (t: string, list?: { from: string; to: string }[]) => list?.find((m) => m.from === t)?.to ?? t;
      const pages = new Map(q.pages.map((p) => [p.title, p]));
      for (const url of batch) {
        const t0 = title(url);
        const t = hop(hop(t0, q.normalized), q.redirects);
        const p = pages.get(t);
        out.push(!p || p.missing || p.invalid ? { url, ok: false, note: 'no such Wikipedia article' } : { url, ok: true, note: t === t0 ? 'article exists' : `article exists (→ ${t})` });
      }
    } catch (e) {
      for (const url of batch) out.push({ url, ok: false, note: `Wikipedia API: ${(e as Error).message}` });
    }
  }
  return out;
}
async function check(url: string): Promise<Result> {
  if (!url.startsWith('https://')) return { url, ok: false, note: 'not https' };
  const bad = blocked(url);
  if (bad) return { url, ok: false, note: `blocked domain (${bad})` };
  const host = new URL(url).hostname;
  if (MANUAL.some((d) => host === d || host.endsWith('.' + d))) return { url, ok: true, manual: true, note: 'blocks automated checks; verify by hand' };
  try {
    const res = await get(url);
    // Cloudflare's bot challenge: the page is there but will not answer scripts. Verify it by hand.
    if (res.status === 403 && res.headers.get('cf-mitigated') === 'challenge') {
      await res.body?.cancel();
      return { url, ok: true, manual: true, note: 'bot challenge (Cloudflare); verify by hand' };
    }
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
    return { url, ok: false, note: (e as Error).message === 'timeout' ? 'timeout' : String((e as Error).cause ?? e) };
  }
}

const all = [...where.keys()].sort();
const urls = all.filter((u) => !WIKI.test(u));
const results: Result[] = [];
for (const r of await checkWikipedia(all.filter((u) => WIKI.test(u)))) {
  results.push(r);
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.url}  ${r.note}`);
}
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
console.log(`\n${all.length} links, ${failed.length} failed, ${manual.length} to verify by hand.`);
for (const r of manual) console.log(`  check by hand: ${r.url}`);
for (const r of failed) console.log(`  ${r.url} — ${r.note}\n    in ${[...where.get(r.url)!].join(', ')}`);
process.exit(failed.length ? 1 : 0);
