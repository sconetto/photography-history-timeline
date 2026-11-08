/**
 * remark-wikilinks: turns [[id]], [[id|label]], [[m:maker]], [[p:primer]] and [[g:term]] into links,
 * and fails the build when a target does not exist, so cross-links cannot rot.
 *
 *   [[daguerreotype]]            → /entries/daguerreotype/      (label: the entry's file name, prettified)
 *   [[daguerreotype|Daguerre's process]]
 *   [[m:kodak]]                  → /makers/kodak/
 *   [[p:aperture]]               → /physics/aperture/
 *   [[g:f-number]]               → /glossary/#f-number          (gets class "gloss" for the hover popover)
 *
 * In a translation (src/content/i18n/<lang>/…) links point into that language (/pt-br/entries/…), glossary
 * terms default to the translated term, and entry, maker and primer links must carry a label, since the
 * default label is the English file name.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const PATTERN = /\[\[(?:([gmp]):)?([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

function idsIn(dir: string, ext: string): Set<string> {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) return new Set();
  return new Set(readdirSync(full).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)));
}
function yamlKeys(name: string): Map<string, string> {
  const full = path.join(ROOT, name);
  // one-line YAML maps ("id: { term: …, def: … }") as used in translations, as well as block maps
  const inline = /^([a-z0-9-]+):\s*\{\s*term:\s*("(?:[^"\\]|\\.)*"|[^,}]+)/;
  const out = new Map<string, string>();
  if (!existsSync(full)) return out;
  let current = '';
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    const one = inline.exec(line);
    if (one) { out.set(one[1], one[2].trim().replace(/^["']|["']$/g, '')); continue; }
    const key = /^([a-z0-9-]+):\s*$/.exec(line);
    if (key) { current = key[1]; out.set(current, current); continue; }
    const term = /^\s+term:\s*(.+)$/.exec(line);
    if (term && current) out.set(current, term[1].replace(/^["']|["']$/g, ''));
  }
  return out;
}

export interface Targets { entries: Set<string>; makers: Set<string>; physics: Set<string>; glossary: Map<string, string>; prefix?: string }
/** Link targets for a file in a language ('' for English, else e.g. 'pt-br'). Ids always come from the English files. */
export function loadTargets(lang = ''): Targets {
  const glossary = yamlKeys('glossary.yaml');
  if (lang) for (const [id, term] of yamlKeys(path.join('i18n', lang, 'glossary.yaml'))) if (glossary.has(id)) glossary.set(id, term);
  return {
    entries: idsIn('entries', '.mdx'),
    makers: idsIn('makers', '.md'),
    physics: idsIn('physics', '.mdx'),
    glossary,
    prefix: lang ? `/${lang}` : '',
  };
}
/** The language of a content file from its path: src/content/i18n/pt-br/entries/x.mdx → 'pt-br'. */
export function langOfFile(file: string): string {
  return /[\\/]content[\\/]i18n[\\/]([a-z-]+)[\\/]/.exec(file)?.[1] ?? '';
}

const pretty = (id: string) => id.replace(/-/g, ' ');

/** Resolve one wikilink. Returns null when the target is unknown. Exported for unit tests. */
export function resolve(t: Targets, prefix: string | undefined, id: string, label?: string) {
  const p = t.prefix ?? '';
  switch (prefix) {
    case 'g': return t.glossary.has(id) ? { url: `${p}/glossary/#${id}`, text: label ?? t.glossary.get(id)!, cls: 'gloss', term: id } : null;
    case 'm': return t.makers.has(id) ? { url: `${p}/makers/${id}/`, text: label ?? pretty(id), cls: 'xref maker' } : null;
    case 'p': return t.physics.has(id) ? { url: `${p}/physics/${id}/`, text: label ?? pretty(id), cls: 'xref primer' } : null;
    default: return t.entries.has(id) ? { url: `${p}/entries/${id}/`, text: label ?? pretty(id), cls: 'xref' } : null;
  }
}

type Node = { type: string; value?: string; children?: Node[]; url?: string; data?: Record<string, unknown> };

export default function remarkWikilinks() {
  return (root: unknown, file: { path?: string; history?: string[] }) => {
    const tree = root as Node;
    // Re-read targets per file so new content files are picked up in dev without a restart.
    const where = file.path ?? file.history?.[0] ?? 'unknown file';
    const lang = langOfFile(where);
    const targets = loadTargets(lang);
    const missing: string[] = [];
    const unlabelled: string[] = [];
    const walk = (node: Node) => {
      if (!node.children) return;
      const next: Node[] = [];
      for (const child of node.children) {
        if (child.type === 'text' && child.value && child.value.includes('[[')) {
          let last = 0;
          const v = child.value;
          for (const m of v.matchAll(PATTERN)) {
            const [whole, prefix, id, label] = m;
            const hit = resolve(targets, prefix, id, label);
            if (!hit) { missing.push(whole); continue; }
            if (lang && !label && prefix !== 'g') unlabelled.push(whole);
            if (m.index! > last) next.push({ type: 'text', value: v.slice(last, m.index) });
            const props: Record<string, string> = { className: hit.cls };
            if ('term' in hit && hit.term) props['data-term'] = hit.term;
            next.push({ type: 'link', url: hit.url, children: [{ type: 'text', value: hit.text }], data: { hProperties: props } });
            last = m.index! + whole.length;
          }
          if (last < v.length) next.push({ type: 'text', value: v.slice(last) });
        } else {
          walk(child);
          next.push(child);
        }
      }
      node.children = next;
    };
    walk(tree);
    if (missing.length) {
      throw new Error(`Unknown wikilink target(s) in ${path.relative(process.cwd(), where)}: ${missing.join(', ')}`);
    }
    if (unlabelled.length) {
      throw new Error(`Translated wikilinks need a label ([[id|text]]) in ${path.relative(process.cwd(), where)}: ${unlabelled.join(', ')}`);
    }
  };
}
