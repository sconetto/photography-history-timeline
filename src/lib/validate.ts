/**
 * Cross-collection checks that Zod schemas can't express. Called once by src/lib/content.ts; any problem fails
 * `astro build` (and shows in the dev overlay) with the complete list, so bad data never ships.
 */
import { findCycle } from './lineage';

export const REQUIRED_SECTIONS = ['How it began', 'How it works', 'Why it mattered', 'Limits and what replaced it'];
/** A maker's story: each slot lists the headings that may fill it (a closed company ends with "Legacy"). */
export const MAKER_SECTIONS = [['Beginnings'], ['Growth and turning points'], ['What it made'], ['Today', 'Legacy']];
/** The headings of a body that are missing from a list of slots, as "A" or "A / B". */
export function missingSections(body: string | undefined, slots: string[][]): string[] {
  const has = (h: string) => new RegExp(`^##\\s+${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(body ?? '');
  return slots.filter((alts) => !alts.some(has)).map((alts) => alts.join(' / '));
}

/** Domains we never link to: unauthorised PDF mirrors and sites that block automated link checks. */
import { blocked } from './blocklist';
export { BLOCKED_DOMAINS, blocked } from './blocklist';

export interface VEntry {
  id: string;
  year: number;
  range?: [number, number];
  end?: number;
  parents: { id: string; kind: string }[];
  body?: string;
  urls: string[];
  makers?: string[];
}
export interface VHighlight { id: string; year: number; entry?: string }
export interface VMaker {
  id: string; founded: number; ended?: number; urls: string[]; links?: { to: string; year: number; kind: string }[];
  body?: string; highlights?: VHighlight[];
}
export interface VInput { entries: VEntry[]; makers: VMaker[]; otherUrls: { where: string; url: string }[]; images?: { where: string; license: string }[] }
/** The only image licences the site accepts: public domain (incl. Commons PD-textlogo, PD-old…) and CC0. */
export const licenseOk = (license: string) => /^(public domain|pd\b|pd-|cc0)/i.test(license.trim());

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;


export function validate({ entries, makers, otherUrls, images = [] }: VInput): string[] {
  const problems: string[] = [];
  const byId = new Map(entries.map((e) => [e.id, e]));

  for (const e of entries) {
    if (!ID.test(e.id)) problems.push(`${e.id}: file name must be lowercase-kebab-case`);
    for (const p of e.parents) {
      const parent = byId.get(p.id);
      if (!parent) problems.push(`${e.id}: unknown parent ${p.id}`);
      else if (parent.year > e.year) problems.push(`${e.id} (${e.year}) is dated earlier than its parent ${p.id} (${parent.year})`);
      if (p.id === e.id) problems.push(`${e.id}: lists itself as a parent`);
    }
    if (e.range && e.range[0] > e.range[1]) problems.push(`${e.id}: range starts after it ends`);
    if (e.end != null && e.end < e.year) problems.push(`${e.id}: end (${e.end}) is before its year (${e.year})`);
    const body = e.body ?? '';
    for (const s of REQUIRED_SECTIONS) {
      if (!new RegExp(`^##\\s+${s}\\s*$`, 'm').test(body)) problems.push(`${e.id}: missing "## ${s}" section`);
    }
    for (const u of e.urls) { const b = blocked(u); if (b) problems.push(`${e.id}: link to blocked domain (${b}): ${u}`); }
  }
  const cycle = findCycle(entries);
  if (cycle.length) problems.push(`lineage cycle: ${cycle.join(' → ')}`);

  const makerIds = new Map(makers.map((m) => [m.id, m]));
  for (const m of makers) {
    if (m.ended != null && m.ended < m.founded) problems.push(`maker ${m.id}: ended before it was founded`);
    for (const l of m.links ?? []) {
      const t = makerIds.get(l.to);
      if (!t) { problems.push(`maker ${m.id}: link to unknown maker "${l.to}"`); continue; }
      if (l.to === m.id) problems.push(`maker ${m.id}: links to itself`);
      if (l.year < m.founded || (m.ended != null && l.year > m.ended)) problems.push(`maker ${m.id}: ${l.kind} link in ${l.year} falls outside its life (${m.founded}–${m.ended ?? 'today'})`);
      if (t.founded > l.year) problems.push(`maker ${m.id}: ${l.kind} → ${l.to} in ${l.year}, but ${l.to} was founded in ${t.founded}`);
      if (t.ended != null && t.ended < l.year) problems.push(`maker ${m.id}: ${l.kind} → ${l.to} in ${l.year}, but ${l.to} ended in ${t.ended}`);
      // a company that merged, was bought, sold out or renamed has left: its bar must stop at that year
      if (['merged', 'acquired', 'renamed'].includes(l.kind) && m.ended !== l.year) problems.push(`maker ${m.id}: ${l.kind} in ${l.year}, so "ended" should be ${l.year}`);
    }
    for (const u of m.urls) { const b = blocked(u); if (b) problems.push(`maker ${m.id}: link to blocked domain (${b}): ${u}`); }
  }
  // highlights: a maker with highlights has the full story too (sections), and every highlight fits the record
  const predecessors = (id: string, seen = new Set<string>()): Set<string> => {
    for (const o of makers) for (const l of o.links ?? []) if (l.to === id && !seen.has(o.id)) { seen.add(o.id); predecessors(o.id, seen); }
    return seen;
  };
  for (const m of makers) {
    const hs = m.highlights ?? [];
    if (!hs.length) continue;
    for (const s of missingSections(m.body, MAKER_SECTIONS)) problems.push(`maker ${m.id}: missing "## ${s}" section`);
    const family = new Set([m.id, ...predecessors(m.id)]);
    const earliest = Math.min(...[...family].map((id) => makerIds.get(id)!.founded));
    const seen = new Set<string>();
    for (const h of hs) {
      if (seen.has(h.id)) problems.push(`maker ${m.id}: highlight "${h.id}" appears twice`);
      seen.add(h.id);
      if (h.year < earliest) problems.push(`maker ${m.id}: highlight "${h.id}" (${h.year}) is older than the company (${earliest})`);
      if (!h.entry) continue;
      const e = byId.get(h.entry);
      if (!e) { problems.push(`maker ${m.id}: highlight "${h.id}" points to unknown entry "${h.entry}"`); continue; }
      const [a, b] = e.range ?? [e.year, e.year];
      if (h.year !== e.year && (h.year < a || h.year > b)) problems.push(`maker ${m.id}: highlight "${h.id}" is dated ${h.year}, but entry ${e.id} is ${e.year}`);
      if (e.makers && !e.makers.some((x) => family.has(x))) problems.push(`maker ${m.id}: highlight "${h.id}" points to entry ${e.id}, which does not list ${m.id} as a maker`);
    }
  }
  for (const { where, license } of images) if (!licenseOk(license)) problems.push(`${where}: image licence "${license}" is not public domain or CC0`);
  for (const { where, url } of otherUrls) { const b = blocked(url); if (b) problems.push(`${where}: link to blocked domain (${b}): ${url}`); }
  return problems;
}

/** One translation file, reduced to what the checks need. */
export interface VTranslation { where: string; kind: 'entry' | 'maker' | 'primer' | 'data'; id: string; body?: string; highlights?: string[] }

/**
 * Translations hold words only, keyed by English ids. Fails on a translation with no English original, and on
 * a translated entry body missing one of the required sections (headings in that language).
 */
export function validateTranslations(
  items: VTranslation[], known: Record<VTranslation['kind'], Set<string>>, sections: string[],
  makers?: { highlights: Map<string, string[]>; sections: string[][] },
): string[] {
  const problems: string[] = [];
  for (const t of items) {
    if (!known[t.kind].has(t.id)) problems.push(`${t.where}: no English ${t.kind} "${t.id}" to translate`);
    if (t.kind === 'maker' && makers) {
      const en = makers.highlights.get(t.id) ?? [];
      const tr = t.highlights ?? [];
      for (const h of tr) if (!en.includes(h)) problems.push(`${t.where}: no English highlight "${h}" to translate`);
      for (const h of en) if (!tr.includes(h)) problems.push(`${t.where}: highlight "${h}" is not translated`);
      if (en.length) for (const s of missingSections(t.body, makers.sections)) problems.push(`${t.where}: missing "## ${s}" section`);
    }
    if (t.kind === 'entry') {
      for (const s of sections) if (!new RegExp(`^##\\s+${s}\\s*$`, 'm').test(t.body ?? '')) problems.push(`${t.where}: missing "## ${s}" section`);
    }
  }
  return problems;
}
