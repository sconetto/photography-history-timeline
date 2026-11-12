/**
 * One place that loads, validates and shapes all content. Every page goes through here.
 * content() is the English site; content('pt-br') is the same content with that language's translated words laid
 * over it by id (src/content/i18n/pt-br/…). Facts (years, links, lineage, images) always come from the English files.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { validate, validateTranslations, type VTranslation } from './validate';
import { LANGS, DEFAULT_LANG, type Lang } from '../i18n/locales';
import { useT } from '../i18n';

/** A content record in one language: `tr` is the translation it was built from (render its body), if any. */
type Loc<C extends 'entries' | 'makers' | 'physics', T extends 'trEntries' | 'trMakers' | 'trPhysics'> =
  CollectionEntry<C> & { tr?: CollectionEntry<T>; wikiLocal?: boolean };
export type Entry = Loc<'entries', 'trEntries'>;
export type Maker = Loc<'makers', 'trMakers'>;
export type Primer = Loc<'physics', 'trPhysics'>;

export const WIKI = 'https://en.wikipedia.org/wiki/';
/** The Wikipedia article for a record: this language's article when the translation names one, else English. */
export const wikiHref = (lang: Lang, rec: { data: { wiki: string }; wikiLocal?: boolean }) =>
  rec.wikiLocal ? `https://${lang.split('-')[0]}.wikipedia.org/wiki/${rec.data.wiki}` : WIKI + rec.data.wiki;

type Base = Awaited<ReturnType<typeof loadBase>>;
let base: Promise<Base> | null = null;
const built = new Map<Lang, Promise<ReturnType<typeof build>>>();

async function loadBase() {
  const [entries, makers, physics, families, eras, milestones, formats, glossary, sources] = await Promise.all([
    getCollection('entries'), getCollection('makers'), getCollection('physics'), getCollection('families'),
    getCollection('eras'), getCollection('milestones'), getCollection('formats'), getCollection('glossary'), getCollection('sources'),
  ]);
  const [trEntries, trMakers, trPhysics, trFamilies, trEras, trMilestones, trFormats, trGlossary, trSources] = await Promise.all([
    getCollection('trEntries'), getCollection('trMakers'), getCollection('trPhysics'), getCollection('trFamilies'), getCollection('trEras'),
    getCollection('trMilestones'), getCollection('trFormats'), getCollection('trGlossary'), getCollection('trSources'),
  ]);

  const problems = validate({
    entries: entries.map((e) => ({
      id: e.id, year: e.data.year, range: e.data.range, end: e.data.end, body: e.body,
      parents: e.data.parents.map((p) => ({ id: p.id.id, kind: p.kind })), makers: e.data.makers.map((m) => m.id),
      urls: [...e.data.refs.map((r) => r[1]), ...(e.data.primary ? [e.data.primary[1]] : []), ...(e.data.image ? [e.data.image.source] : [])],
    })),
    makers: makers.map((m) => ({
      id: m.id, founded: m.data.founded, ended: m.data.ended, body: m.body,
      urls: [...m.data.refs.map((r) => r[1]), ...(m.data.logo ? [m.data.logo.source] : []), ...m.data.highlights.flatMap((h) => (h.image ? [h.image.source] : []))],
      links: m.data.links.map((l) => ({ to: l.to.id, year: l.year, kind: l.kind })),
      highlights: m.data.highlights.map((h) => ({ id: h.id, year: h.year, entry: h.entry?.id })),
    })),
    otherUrls: [
      ...physics.flatMap((p) => p.data.refs.map((r) => ({ where: `primer ${p.id}`, url: r[1] }))),
      ...milestones.flatMap((m) => [...m.data.refs.map((r) => ({ where: `milestone ${m.id}`, url: r[1] })), ...(m.data.image ? [{ where: `milestone ${m.id}`, url: m.data.image.source }] : [])]),
      ...sources.flatMap((s) => (s.data.url ? [{ where: `source ${s.id}`, url: s.data.url }] : [])),
    ],
    images: [
      ...entries.flatMap((e) => (e.data.image ? [{ where: `entry ${e.id}`, license: e.data.image.license }] : [])),
      ...milestones.flatMap((m) => (m.data.image ? [{ where: `milestone ${m.id}`, license: m.data.image.license }] : [])),
      ...makers.flatMap((m) => [
        ...(m.data.logo ? [{ where: `maker ${m.id} logo`, license: m.data.logo.license }] : []),
        ...m.data.highlights.flatMap((h) => (h.image ? [{ where: `maker ${m.id} highlight ${h.id}`, license: h.image.license }] : [])),
      ]),
    ],
  });

  // translations, split by language: "pt-br/entries/daguerreotype" → lang pt-br, id daguerreotype
  const split = (id: string) => { const [lang, ...rest] = id.split('/'); return { lang: lang as Lang, id: rest.at(-1)! }; };
  const byLang = <T extends { id: string }>(list: T[]) => {
    const out = new Map<Lang, Map<string, T>>();
    for (const t of list) { const { lang, id } = split(t.id); (out.get(lang) ?? out.set(lang, new Map()).get(lang)!).set(id, t); }
    return out;
  };
  const dataByLang = <D>(list: { id: string; data: Record<string, D> }[]) => {
    const out = new Map<Lang, Map<string, D>>();
    for (const t of list) out.set(split(t.id).lang, new Map(Object.entries(t.data)));
    return out;
  };
  const tr = {
    entries: byLang(trEntries), makers: byLang(trMakers), physics: byLang(trPhysics),
    families: dataByLang(trFamilies), eras: dataByLang(trEras), milestones: dataByLang(trMilestones),
    formats: dataByLang(trFormats), glossary: dataByLang(trGlossary), sources: dataByLang(trSources),
  };
  const known = {
    entry: new Set(entries.map((e) => e.id)), maker: new Set(makers.map((m) => m.id)), primer: new Set(physics.map((p) => p.id)),
    data: new Set([...families, ...eras, ...milestones, ...formats, ...glossary, ...sources].map((x) => x.id)),
  };
  for (const lang of LANGS.filter((l) => l !== DEFAULT_LANG)) {
    if (![...trEntries, ...trMakers, ...trPhysics].some((t) => split(t.id).lang === lang) && !tr.families.has(lang)) continue;
    const t = useT(lang);
    const items: VTranslation[] = [
      ...[...(tr.entries.get(lang)?.values() ?? [])].map((x) => ({ where: x.id, kind: 'entry' as const, id: split(x.id).id, body: x.body })),
      ...[...(tr.makers.get(lang)?.values() ?? [])].map((x) => ({ where: x.id, kind: 'maker' as const, id: split(x.id).id, body: x.body, highlights: Object.keys(x.data.highlights ?? {}) })),
      ...[...(tr.physics.get(lang)?.values() ?? [])].map((x) => ({ where: x.id, kind: 'primer' as const, id: split(x.id).id })),
      ...(['families', 'eras', 'milestones', 'formats', 'glossary', 'sources'] as const).flatMap((k) =>
        [...(tr[k].get(lang)?.keys() ?? [])].map((id) => ({ where: `${lang}/${k}.yaml`, kind: 'data' as const, id }))),
    ];
    problems.push(...validateTranslations(items, known, [t('entry.how.began'), t('entry.how.works'), t('entry.how.mattered'), t('entry.how.limits')], {
      highlights: new Map(makers.map((m) => [m.id, m.data.highlights.map((h) => h.id)])),
      sections: [[t('maker.sec.beginnings')], [t('maker.sec.growth')], [t('maker.sec.made')], [t('maker.sec.today'), t('maker.sec.legacy')]],
    }));
  }
  if (problems.length) {
    throw new Error(`Content problems, nothing built:\n  ${problems.join('\n  ')}`);
  }

  const byYear = (a: CollectionEntry<'entries'>, b: CollectionEntry<'entries'>) => a.data.year - b.data.year || a.data.label.localeCompare(b.data.label);
  entries.sort(byYear);
  families.sort((a, b) => a.data.order - b.data.order);
  physics.sort((a, b) => a.data.order - b.data.order);
  milestones.sort((a, b) => a.data.year - b.data.year);
  eras.sort((a, b) => a.data.a - b.data.a);
  return { entries, makers, physics, families, eras, milestones, formats, glossary, sources, tr };
}

/** Lay one language's words over the English records (order and facts unchanged). */
function localise(b: Base, lang: Lang) {
  const L = <K extends keyof Base['tr']>(k: K) => b.tr[k].get(lang) as Base['tr'][K] extends Map<Lang, infer M> ? M | undefined : never;
  const te = L('entries'), tm = L('makers'), tp = L('physics');
  const entries: Entry[] = b.entries.map((e) => {
    const t = te?.get(e.id);
    if (!t) return e;
    const d = t.data;
    return {
      ...e, tr: t, wikiLocal: !!d.wiki, body: t.body,
      data: {
        ...e.data, title: d.title, label: d.label, ds: d.ds, date: d.date, summary: d.summary, today: d.today,
        people: d.people ?? e.data.people, moments: d.moments ?? e.data.moments, specs: d.specs ?? e.data.specs,
        sourceNotes: d.sourceNotes ?? e.data.sourceNotes, wiki: d.wiki ?? e.data.wiki,
        exposure: e.data.exposure && d.exposureNote ? { ...e.data.exposure, note: d.exposureNote } : e.data.exposure,
        image: e.data.image && d.imageAlt ? { ...e.data.image, alt: d.imageAlt } : e.data.image,
      },
    };
  });
  const makers: Maker[] = b.makers.map((m) => {
    const t = tm?.get(m.id);
    if (!t) return m;
    const d = t.data;
    return {
      ...m, tr: t, wikiLocal: !!d.wiki, body: t.body,
      data: {
        ...m.data, name: d.name ?? m.data.name, fate: d.fate, wiki: d.wiki ?? m.data.wiki,
        links: m.data.links.map((l) => ({ ...l, note: l.note && (d.linkNotes?.[l.to.id] ?? l.note) })),
        logo: m.data.logo && d.logoAlt ? { ...m.data.logo, alt: d.logoAlt } : m.data.logo,
        highlights: m.data.highlights.map((h) => {
          const w = d.highlights?.[h.id];
          return w ? { ...h, name: w.name ?? h.name, note: w.note, image: h.image && w.alt ? { ...h.image, alt: w.alt } : h.image } : h;
        }),
      },
    };
  });
  const physics: Primer[] = b.physics.map((p) => {
    const t = tp?.get(p.id);
    return t ? { ...p, tr: t, body: t.body, data: { ...p.data, ...t.data, equations: t.data.equations ?? p.data.equations } } : p;
  });
  const over = <R extends { id: string; data: object }>(list: R[], words: Map<string, unknown> | undefined) =>
    list.map((r) => { const w = words?.get(r.id) as object | undefined; return w ? { ...r, data: { ...r.data, ...w } } : r; }) as R[];
  const milestones = b.milestones.map((m) => {
    const w = L('milestones')?.get(m.id) as { imageAlt?: string } | undefined;
    const r = over([m], L('milestones'))[0];
    return w?.imageAlt && r.data.image ? { ...r, data: { ...r.data, image: { ...r.data.image, alt: w.imageAlt } } } : r;
  });
  return {
    entries, makers, physics, milestones,
    families: over(b.families, L('families')), eras: over(b.eras, L('eras')), formats: over(b.formats, L('formats')),
    glossary: over(b.glossary, L('glossary')), sources: over(b.sources, L('sources')),
  };
}

/** Lookups and reverse links for one language's records. */
function build(lists: ReturnType<typeof localise>) {
  const { entries, makers, physics, families } = lists;
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const makerById = new Map(makers.map((m) => [m.id, m]));
  const primerById = new Map(physics.map((p) => [p.id, p]));
  const familyById = new Map(families.map((f) => [f.id, f]));

  const children = new Map<string, { id: string; kind: 'built' | 'enabled' | 'replaced' }[]>();
  for (const e of entries) children.set(e.id, []);
  for (const e of entries) for (const p of e.data.parents) children.get(p.id.id)!.push({ id: e.id, kind: p.kind });

  const primerEntries = new Map<string, Entry[]>();
  for (const e of entries) for (const p of e.data.primers) (primerEntries.get(p.id) ?? primerEntries.set(p.id, []).get(p.id)!).push(e);
  /** links pointing at a maker: who merged into it, was bought by it, sold to it… */
  const makerIncoming = new Map<string, { from: Maker; year: number; kind: string; note?: string }[]>();
  for (const m of makers) for (const l of m.data.links) (makerIncoming.get(l.to.id) ?? makerIncoming.set(l.to.id, []).get(l.to.id)!).push({ from: m, year: l.year, kind: l.kind, note: l.note });
  /** which pages link each glossary term with [[g:term]]; hrefs are unprefixed (pages pass them through url()) */
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

  return { ...lists, entryById, makerById, primerById, familyById, children, primerEntries, makerEntries, makerIncoming, glossaryUsage };
}

/** All content in one language, loaded and validated once per build. */
export function content(lang: Lang = DEFAULT_LANG) {
  base ??= loadBase();
  if (!built.has(lang)) built.set(lang, base.then((b) => build(lang === DEFAULT_LANG ? (b as unknown as ReturnType<typeof localise>) : localise(b, lang))));
  return built.get(lang)!;
}

/** What is not yet translated into a language (empty for English). Used by tests and scripts/i18n-status.ts. */
export async function untranslated(lang: Lang) {
  if (lang === DEFAULT_LANG) return [];
  const b = await (base ??= loadBase());
  const missing: string[] = [];
  for (const k of ['entries', 'makers', 'physics'] as const) for (const r of b[k]) if (!b.tr[k].get(lang)?.has(r.id)) missing.push(`${k}/${r.id}`);
  for (const k of ['families', 'eras', 'milestones', 'formats', 'glossary', 'sources'] as const) for (const r of b[k]) if (!b.tr[k].get(lang)?.has(r.id)) missing.push(`${k}/${r.id}`);
  return missing;
}
