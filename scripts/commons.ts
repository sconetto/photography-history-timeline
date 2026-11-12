/**
 * Find and fetch public-domain images from Wikimedia Commons, with the credit the content schema needs.
 *
 *   node scripts/commons.ts search "boulevard du temple daguerre"     list candidate files with size and licence
 *   node scripts/commons.ts info "File:Some file.jpg"                 show one file's metadata
 *   node scripts/commons.ts get "File:Some file.jpg" boulevard-du-temple [width]
 *        downloads a scaled copy to src/assets/img/<name>.<ext> and prints the frontmatter `image:` block
 *   node scripts/commons.ts get "File:Canon wordmark.svg" makers/canon-logo --original
 *        keeps an SVG as a vector (for logos): it is cleaned of scripts, handlers and external references
 *        first, and refused if anything unsafe is left. <name> may include a folder (makers/…).
 *
 * Only public-domain and CC0 files are accepted: `get` refuses anything else.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cleanSvg } from '../src/lib/svg.ts';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'PhotographyThroughTime/0.1 (https://github.com/sconetto/photography-history-timeline)';
const PD = /^(public domain|pd\b|pd-|cc0)/i;

async function api(params: Record<string, string>) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json() as Promise<any>;
}

const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

async function info(titles: string[], width = 1400) {
  const j = await api({ action: 'query', titles: titles.join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(width) });
  return (j.query?.pages ?? []).map((p: any) => {
    const ii = p.imageinfo?.[0];
    const m = ii?.extmetadata ?? {};
    return {
      title: p.title as string, missing: !ii,
      w: ii?.width, h: ii?.height, mime: ii?.mime, thumb: ii?.thumburl as string, url: ii?.url as string, page: ii?.descriptionurl as string,
      license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value), credit: strip(m.Credit?.value),
      date: strip(m.DateTimeOriginal?.value).replace(/date QS.*/, ''), desc: strip(m.ImageDescription?.value).slice(0, 220),
    };
  });
}

const argv = process.argv.slice(2);
const ORIGINAL = argv.includes('--original');
const [cmd, arg, name, width] = argv.filter((a) => a !== '--original');
if (cmd === 'search') {
  const j = await api({ action: 'query', list: 'search', srnamespace: '6', srsearch: arg, srlimit: '12' });
  const rows = await info(j.query.search.map((s: any) => s.title), 300);
  for (const r of rows) console.log(`${PD.test(r.license) ? '✓' : '✗'} ${r.title}\n    ${r.w}×${r.h} · ${r.license} · ${r.artist.slice(0, 60)} · ${r.date.slice(0, 30)}`);
} else if (cmd === 'info') {
  console.log(JSON.stringify((await info([arg]))[0], null, 2));
} else if (cmd === 'get') {
  const [r] = await info([arg], Number(width) || 1400);
  if (r.missing) throw new Error(`not found: ${arg}`);
  if (!PD.test(r.license)) throw new Error(`refusing ${arg}: licence is "${r.license}"`);
  const svg = ORIGINAL && r.mime === 'image/svg+xml';
  if (ORIGINAL && !svg) throw new Error(`--original is for SVG files; ${arg} is ${r.mime}`);
  const from = svg ? r.url : r.thumb;
  const ext = svg ? 'svg' : (r.thumb.match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const res = await fetch(from, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${from}`);
  const out = `src/assets/img/${name}.${ext}`;
  await mkdir(path.dirname(out), { recursive: true });
  if (svg) {
    const { svg: clean, problems } = cleanSvg(await res.text());
    if (problems.length) throw new Error(`refusing ${arg}: ${problems.join('; ')}`);
    await writeFile(out, clean);
  } else {
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
  }
  const credit = [r.artist || 'Unknown', r.date && `(${r.date.slice(0, 40)})`, r.credit && r.credit !== r.artist ? `, ${r.credit.slice(0, 90)}` : ''].filter(Boolean).join(' ').replace(' ,', ',');
  console.log(`saved ${out}\nimage:\n  src: ../../assets/img/${name}.${ext}\n  alt: "TODO"\n  credit: ${JSON.stringify(credit)}\n  license: ${JSON.stringify(r.license)}\n  source: ${JSON.stringify(r.page)}\n# ${r.desc}`);
} else {
  console.log('usage: node scripts/commons.ts search <query> | info <File:…> | get <File:…> <name> [width] [--original]');
}
