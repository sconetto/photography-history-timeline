/**
 * pnpm i18n:status — list every English record that has no translation, per language.
 * Reads the files directly (the build validates their contents); exits non-zero if anything is missing.
 * Languages are the folders in src/content/i18n.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CONTENT = path.resolve(import.meta.dirname, '..', 'src', 'content');
const I18N = path.join(CONTENT, 'i18n');
const FOLDERS = ['entries', 'makers', 'physics'] as const;
const DATA = ['families', 'eras', 'milestones', 'formats', 'glossary', 'sources'] as const;

const ids = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.mdx?$/.test(f)).map((f) => f.replace(/\.mdx?$/, '')) : []);
/** Top-level keys of a YAML map: lines that start at column 0 with "id:". */
const keys = (file: string) => (existsSync(file) ? [...readFileSync(file, 'utf8').matchAll(/^([A-Za-z0-9][\w-]*)\s*:/gm)].map((m) => m[1]) : []);

/** The frontmatter block of a Markdown file. */
const front = (file: string) => (existsSync(file) ? /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '' : '');
/** English highlight ids ("  - id: f-1" under highlights:) and the ids a translation covers ("  f-1:" under highlights:). */
const enHighlights = (fm: string) => [...(/^highlights:\n((?:[ -].*\n?)*)/m.exec(fm)?.[1] ?? '').matchAll(/^\s+- id:\s*["']?([a-z0-9-]+)/gm)].map((m) => m[1]);
const trHighlights = (fm: string) => [...(/^highlights:\n((?: .*\n?)*)/m.exec(fm)?.[1] ?? '').matchAll(/^  ([a-z0-9-]+):/gm)].map((m) => m[1]);

let missingTotal = 0;
for (const lang of readdirSync(I18N).filter((d) => !d.startsWith('.'))) {
  const missing: string[] = [];
  const counts: string[] = [];
  for (const k of FOLDERS) {
    const have = new Set(ids(path.join(I18N, lang, k)));
    const all = ids(path.join(CONTENT, k));
    for (const id of all) if (!have.has(id)) missing.push(`${k}/${id}`);
    counts.push(`${k} ${all.filter((id) => have.has(id)).length}/${all.length}`);
  }
  // makers: every English highlight needs a translated note
  let hlAll = 0, hlHave = 0;
  for (const id of ids(path.join(CONTENT, 'makers'))) {
    const en = enHighlights(front(path.join(CONTENT, 'makers', `${id}.md`)));
    const have = new Set(trHighlights(front(path.join(I18N, lang, 'makers', `${id}.md`))));
    hlAll += en.length;
    for (const h of en) if (have.has(h)) hlHave++; else missing.push(`makers/${id} highlight ${h}`);
  }
  if (hlAll) counts.push(`maker highlights ${hlHave}/${hlAll}`);
  for (const k of DATA) {
    const have = new Set(keys(path.join(I18N, lang, `${k}.yaml`)));
    const all = keys(path.join(CONTENT, `${k}.yaml`));
    for (const id of all) if (!have.has(id)) missing.push(`${k}/${id}`);
    counts.push(`${k} ${all.filter((id) => have.has(id)).length}/${all.length}`);
  }
  console.log(`${lang}: ${missing.length ? `${missing.length} untranslated` : 'complete'}  (${counts.join(', ')})`);
  for (const m of missing) console.log(`  - ${m}`);
  missingTotal += missing.length;
}
process.exit(missingTotal ? 1 : 0);
