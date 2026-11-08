/**
 * remark-wikilinks: turns [[id]], [[id|label]], [[m:maker]], [[p:primer]] and [[g:term]] into links,
 * and fails the build when a target does not exist, so cross-links cannot rot.
 *
 *   [[daguerreotype]]            → /entries/daguerreotype/      (label: the entry's file name, prettified)
 *   [[daguerreotype|Daguerre's process]]
 *   [[m:kodak]]                  → /makers/kodak/
 *   [[p:aperture]]               → /physics/aperture/
 *   [[g:f-number]]               → /glossary/#f-number          (gets class "gloss" for the hover popover)
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
  const out = new Map<string, string>();
  if (!existsSync(full)) return out;
  let current = '';
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    const key = /^([a-z0-9-]+):\s*$/.exec(line);
    if (key) { current = key[1]; out.set(current, current); continue; }
    const term = /^\s+term:\s*(.+)$/.exec(line);
    if (term && current) out.set(current, term[1].replace(/^["']|["']$/g, ''));
  }
  return out;
}

export interface Targets { entries: Set<string>; makers: Set<string>; physics: Set<string>; glossary: Map<string, string> }
export function loadTargets(): Targets {
  return {
    entries: idsIn('entries', '.mdx'),
    makers: idsIn('makers', '.md'),
    physics: idsIn('physics', '.mdx'),
    glossary: yamlKeys('glossary.yaml'),
  };
}

const pretty = (id: string) => id.replace(/-/g, ' ');

/** Resolve one wikilink. Returns null when the target is unknown. Exported for unit tests. */
export function resolve(t: Targets, prefix: string | undefined, id: string, label?: string) {
  switch (prefix) {
    case 'g': return t.glossary.has(id) ? { url: `/glossary/#${id}`, text: label ?? t.glossary.get(id)!, cls: 'gloss', term: id } : null;
    case 'm': return t.makers.has(id) ? { url: `/makers/${id}/`, text: label ?? pretty(id), cls: 'xref maker' } : null;
    case 'p': return t.physics.has(id) ? { url: `/physics/${id}/`, text: label ?? pretty(id), cls: 'xref primer' } : null;
    default: return t.entries.has(id) ? { url: `/entries/${id}/`, text: label ?? pretty(id), cls: 'xref' } : null;
  }
}

type Node = { type: string; value?: string; children?: Node[]; url?: string; data?: Record<string, unknown> };

export default function remarkWikilinks() {
  return (root: unknown, file: { path?: string; history?: string[] }) => {
    const tree = root as Node;
    // Re-read targets per file so new content files are picked up in dev without a restart.
    const targets = loadTargets();
    const where = file.path ?? file.history?.[0] ?? 'unknown file';
    const missing: string[] = [];
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
  };
}
