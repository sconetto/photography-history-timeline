/** One place that loads, validates and shapes all content. Every page goes through here. */
import { getCollection, type CollectionEntry } from 'astro:content';
import { validate } from './validate';

export type Entry = CollectionEntry<'entries'>;
export type Maker = CollectionEntry<'makers'>;
/** How each kind of maker link reads, forwards (A → B) and backwards (B ← A). */
export const LINK_TEXT: Record<string, { out: string; in: string }> = {
  merged: { out: 'Merged into', in: 'Formed by merger of' },
  acquired: { out: 'Bought by', in: 'Bought' },
  sold: { out: 'Sold business to', in: 'Took over business of' },
  renamed: { out: 'Renamed', in: 'Formerly' },
  stake: { out: 'Controlling stake taken by', in: 'Holds a controlling stake in' },
  revived: { out: 'Product revived by', in: 'Revived the product of' },
};
export type Primer = CollectionEntry<'physics'>;

export const SIDE_TEXT = { invention: 'Discovery or invention', product: 'Camera, format or product' } as const;
export const IMPACT_TEXT = { xl: 'Changed photography for everyone', l: 'Major', m: 'Significant', s: 'Niche' } as const;
export const STATUS_TEXT = { inuse: 'Still in use', revived: 'Revived', niche: 'Niche today', obsolete: 'Obsolete' } as const;
export const KIND_UP = { built: 'built on', enabled: 'made possible by', replaced: 'replaced' } as const;
export const KIND_DOWN = { built: 'built on it', enabled: 'it made possible', replaced: 'replaced it' } as const;
export const WIKI = 'https://en.wikipedia.org/wiki/';

let cache: Promise<Awaited<ReturnType<typeof load>>> | null = null;

async function load() {
  const [entries, makers, physics, families, eras, milestones, formats, glossary, sources] = await Promise.all([
    getCollection('entries'), getCollection('makers'), getCollection('physics'), getCollection('families'),
    getCollection('eras'), getCollection('milestones'), getCollection('formats'), getCollection('glossary'), getCollection('sources'),
  ]);

  const problems = validate({
    entries: entries.map((e) => ({
      id: e.id, year: e.data.year, range: e.data.range, end: e.data.end, body: e.body,
      parents: e.data.parents.map((p) => ({ id: p.id.id, kind: p.kind })),
      urls: [...e.data.refs.map((r) => r[1]), ...(e.data.primary ? [e.data.primary[1]] : []), ...(e.data.image ? [e.data.image.source] : [])],
    })),
    makers: makers.map((m) => ({ id: m.id, founded: m.data.founded, ended: m.data.ended, urls: m.data.refs.map((r) => r[1]), links: m.data.links.map((l) => ({ to: l.to.id, year: l.year, kind: l.kind })) })),
    otherUrls: [
      ...physics.flatMap((p) => p.data.refs.map((r) => ({ where: `primer ${p.id}`, url: r[1] }))),
      ...milestones.flatMap((m) => [...m.data.refs.map((r) => ({ where: `milestone ${m.id}`, url: r[1] })), ...(m.data.image ? [{ where: `milestone ${m.id}`, url: m.data.image.source }] : [])]),
      ...sources.flatMap((s) => (s.data.url ? [{ where: `source ${s.id}`, url: s.data.url }] : [])),
    ],
  });
  if (problems.length) {
    throw new Error(`Content problems, nothing built:\n  ${problems.join('\n  ')}`);
  }

  const byYear = (a: Entry, b: Entry) => a.data.year - b.data.year || a.data.label.localeCompare(b.data.label);
  entries.sort(byYear);
  families.sort((a, b) => a.data.order - b.data.order);
  physics.sort((a, b) => a.data.order - b.data.order);
  milestones.sort((a, b) => a.data.year - b.data.year);
  eras.sort((a, b) => a.data.a - b.data.a);

  const entryById = new Map(entries.map((e) => [e.id, e]));
  const makerById = new Map(makers.map((m) => [m.id, m]));
  const primerById = new Map(physics.map((p) => [p.id, p]));
  const familyById = new Map(families.map((f) => [f.id, f]));

  const children = new Map<string, { id: string; kind: keyof typeof KIND_DOWN }[]>();
  for (const e of entries) children.set(e.id, []);
  for (const e of entries) for (const p of e.data.parents) children.get(p.id.id)!.push({ id: e.id, kind: p.kind });

  const primerEntries = new Map<string, Entry[]>();
  for (const e of entries) for (const p of e.data.primers) (primerEntries.get(p.id) ?? primerEntries.set(p.id, []).get(p.id)!).push(e);
  /** links pointing at a maker: who merged into it, was bought by it, sold to it… */
  const makerIncoming = new Map<string, { from: Maker; year: number; kind: string; note?: string }[]>();
  for (const m of makers) for (const l of m.data.links) (makerIncoming.get(l.to.id) ?? makerIncoming.set(l.to.id, []).get(l.to.id)!).push({ from: m, year: l.year, kind: l.kind, note: l.note });
  /** which pages link each glossary term with [[g:term]] */
  const glossaryUsage = new Map<string, { href: string; label: string; kind: 'entry' | 'maker' | 'primer' }[]>();
  const scan = (body: string | undefined, href: string, label: string, kind: 'entry' | 'maker' | 'primer') => {
    for (const m of new Set([...(body ?? '').matchAll(/\[\[g:([a-z0-9-]+)/g)].map((x) => x[1])))
      (glossaryUsage.get(m) ?? glossaryUsage.set(m, []).get(m)!).push({ href, label, kind });
  };
  for (const e of entries) scan(e.body, `/entries/${e.id}/`, e.data.label, 'entry');
  for (const p of physics) scan(p.body, `/physics/${p.id}/`, p.data.short, 'primer');
  for (const m of makers) scan(m.body, `/makers/${m.id}/`, m.data.name.replace(/\s*\(.*\)$/, ''), 'maker');
  const makerEntries = new Map<string, Entry[]>();
  for (const e of entries) for (const m of e.data.makers) (makerEntries.get(m.id) ?? makerEntries.set(m.id, []).get(m.id)!).push(e);

  return {
    entries, makers, physics, families, eras, milestones, formats, glossary, sources,
    entryById, makerById, primerById, familyById, children, primerEntries, makerEntries, makerIncoming, glossaryUsage,
  };
}

/** Loads and validates once per build. */
export function content() {
  return (cache ??= load());
}
