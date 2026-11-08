/**
 * Cross-collection checks that Zod schemas can't express. Called once by src/lib/content.ts; any problem fails
 * `astro build` (and shows in the dev overlay) with the complete list, so bad data never ships.
 */
import { findCycle } from './lineage';

export const REQUIRED_SECTIONS = ['How it began', 'How it works', 'Why it mattered', 'Limits and what replaced it'];

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
}
export interface VMaker { id: string; founded: number; ended?: number; urls: string[]; links?: { to: string; year: number; kind: string }[] }
export interface VInput { entries: VEntry[]; makers: VMaker[]; otherUrls: { where: string; url: string }[] }

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;


export function validate({ entries, makers, otherUrls }: VInput): string[] {
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
  for (const { where, url } of otherUrls) { const b = blocked(url); if (b) problems.push(`${where}: link to blocked domain (${b}): ${url}`); }
  return problems;
}
