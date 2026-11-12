import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';
import { CAMERA_TYPES } from './lib/cameras';

/** Every outbound link must be https. Domain blocklist checks live in src/lib/validate.ts. */
const https = z.string().refine((s) => s.startsWith('https://'), { message: 'links must start with https://' });
const link = z.tuple([z.string().min(1), https]);
const year = z.number().int().min(-1000).max(2100);

const FAMILIES = ['optics', 'chem', 'colour', 'cameras', 'formats', 'control', 'digital', 'sharing'] as const;
/** merged: both became a new company · acquired: bought outright · sold: sold its camera/film business ·
 *  renamed: same company, new name · stake: took a controlling stake, company carries on · revived: a new company restarted the product */
export const MAKER_LINKS = ['merged', 'acquired', 'sold', 'renamed', 'stake', 'revived'] as const;
/** what a maker's highlight is: drives the card's kind label and whether a camera drawing can stand in for a photo */
export const HIGHLIGHT_KINDS = ['camera', 'lens', 'film', 'meter', 'software', 'other'] as const;
export const COUNTRIES = ['Japan', 'USA', 'Germany', 'France', 'UK', 'Sweden', 'USSR', 'China', 'South Korea', 'Denmark', 'Austria', 'Netherlands'] as const;

const imageSchema = (image: () => z.ZodType) =>
  z.object({
    src: image(),
    alt: z.string().min(10),
    credit: z.string().min(3),
    license: z.string().min(3),
    source: https,
  });

const entries = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/entries' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      label: z.string().max(40),
      fam: z.enum(FAMILIES),
      kind: z.enum(['discovery', 'process', 'camera', 'format', 'technology', 'standard']),
      year,
      ds: z.string(),
      date: z.string(),
      range: z.tuple([year, year]).optional(),
      end: year.optional(),
      side: z.enum(['invention', 'product']),
      impact: z.enum(['xl', 'l', 'm', 's']),
      status: z.enum(['inuse', 'revived', 'niche', 'obsolete']),
      summary: z.string().min(40).max(240),
      today: z.string().min(10).max(260),
      parents: z.array(z.object({ id: reference('entries'), kind: z.enum(['built', 'enabled', 'replaced']) })).default([]),
      makers: z.array(reference('makers')).default([]),
      primers: z.array(reference('physics')).default([]),
      cameraType: z.enum(CAMERA_TYPES).optional(),
      people: z.array(z.tuple([z.string(), z.string(), z.string()])).default([]),
      moments: z.array(z.tuple([z.string(), z.string()])).default([]),
      specs: z.array(z.tuple([z.string(), z.string()])).default([]),
      exposure: z.object({ seconds: z.number().positive(), note: z.string() }).optional(),
      frame: z.tuple([z.number().positive(), z.number().positive()]).optional(),
      image: imageSchema(image).optional(),
      wiki: z.string(),
      refs: z.array(link).default([]),
      primary: link.optional(),
      sourceNotes: z.array(z.string()).default([]),
    }),
});

const makers = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/makers' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    country: z.enum(COUNTRIES),
    founded: year,
    ended: year.optional(),
    fate: z.string(),
    // corporate lineage, drawn as connectors on the makers chart: this company → another, in a given year
    links: z.array(z.object({
      to: reference('makers'),
      year,
      kind: z.enum(MAKER_LINKS),
      note: z.string().optional(),
    })).default([]),
    wiki: z.string(),
    refs: z.array(link).default([]),
    // a public-domain logo (Commons PD-textlogo or PD-old), shown only to identify the company; era says which logo it is
    logo: imageSchema(image).extend({ era: z.string().min(3) }).optional(),
    // the products that defined the company: cameras for camera makers, films, lenses or meters for the others.
    // Order matters: the first two are the best known (shown on the makers chart); pages sort them by year.
    highlights: z.array(z.object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      name: z.string().min(2),
      year,
      kind: z.enum(HIGHLIGHT_KINDS),
      cameraType: z.enum(CAMERA_TYPES).optional(),
      entry: reference('entries').optional(),
      note: z.string().min(40).max(260),
      image: imageSchema(image).optional(),
    })).default([]),
  }),
});

const physics = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/physics' }),
  schema: z.object({
    title: z.string(),
    short: z.string().max(30),
    order: z.number().int(),
    dek: z.string(),
    widget: z.enum(['pinhole', 'lensfov', 'aperture', 'exposure', 'exposurehistory', 'colour', 'bayer', 'formats', 'stacking']),
    equations: z.array(z.tuple([z.string(), z.string()])).default([]),
    refs: z.array(link).default([]),
  }),
});

const families = defineCollection({
  loader: file('src/content/families.yaml'),
  schema: z.object({ name: z.string(), short: z.string(), order: z.number().int(), blurb: z.string() }),
});

const eras = defineCollection({
  loader: file('src/content/eras.yaml'),
  schema: z.object({ name: z.string(), short: z.string(), a: year, b: year }),
});

const milestones = defineCollection({
  loader: file('src/content/milestones.yaml'),
  schema: ({ image }) =>
    z.object({
      year: z.number().min(-1000).max(2100), // fractional years separate same-year diamonds
      label: z.string(),
      when: z.string(),
      note: z.string(),
      entry: reference('entries').optional(),
      image: imageSchema(image).optional(),
      refs: z.array(link).default([]),
    }),
});

const formats = defineCollection({
  loader: file('src/content/formats.yaml'),
  schema: z.object({
    name: z.string(),
    group: z.enum(['large', 'medium', 'full', 'smaller', 'film-small']),
    w: z.number().positive(),
    h: z.number().positive(),
    entry: reference('entries').optional(),
    note: z.string(),
  }),
});

const glossary = defineCollection({
  loader: file('src/content/glossary.yaml'),
  schema: z.object({ term: z.string(), def: z.string(), see: z.array(z.string()).default([]) }),
});

const sources = defineCollection({
  loader: file('src/content/sources.yaml'),
  schema: z.object({ label: z.string(), url: https.optional(), note: z.string().optional(), kind: z.enum(['book', 'web', 'archive']) }),
});

// ---------- translations: words only, keyed by the English ids; facts (dates, links, references) stay in the English files.
// Files live in src/content/i18n/<lang>/… and get ids like "pt-br/entries/daguerreotype" or "pt-br/glossary".
const I18N = './src/content/i18n';
const pair = z.tuple([z.string(), z.string()]);

const trEntries = defineCollection({
  loader: glob({ pattern: '*/entries/*.mdx', base: I18N }),
  schema: z.object({
    title: z.string(),
    label: z.string().max(40),
    ds: z.string(),
    date: z.string(),
    summary: z.string().min(40).max(260),
    today: z.string().min(10).max(290),
    people: z.array(z.tuple([z.string(), z.string(), z.string()])).optional(),
    moments: z.array(pair).optional(),
    specs: z.array(pair).optional(),
    exposureNote: z.string().optional(),
    imageAlt: z.string().min(10).optional(),
    sourceNotes: z.array(z.string()).optional(),
    wiki: z.string().optional(), // the article on this language's Wikipedia
  }),
});
const trMakers = defineCollection({
  loader: glob({ pattern: '*/makers/*.md', base: I18N }),
  schema: z.object({
    name: z.string().optional(),
    fate: z.string(),
    linkNotes: z.record(z.string(), z.string()).optional(), // keyed by the target maker id
    wiki: z.string().optional(),
    logoAlt: z.string().min(10).optional(),
    // keyed by the English highlight id; name only when it differs (model names usually stay as they are)
    highlights: z.record(z.string(), z.object({ name: z.string().optional(), note: z.string().min(40).max(260), alt: z.string().min(10).optional() })).optional(),
  }),
});
const trPhysics = defineCollection({
  loader: glob({ pattern: '*/physics/*.mdx', base: I18N }),
  schema: z.object({ title: z.string(), short: z.string().max(34), dek: z.string(), equations: z.array(pair).optional() }),
});
const byId = <T extends z.ZodTypeAny>(item: T) => z.record(z.string(), item);
const trData = (name: string, item: z.ZodTypeAny) => defineCollection({ loader: glob({ pattern: `*/${name}.yaml`, base: I18N }), schema: byId(item) });
const trFamilies = trData('families', z.object({ name: z.string(), short: z.string(), blurb: z.string() }));
const trEras = trData('eras', z.object({ name: z.string(), short: z.string() }));
const trMilestones = trData('milestones', z.object({ label: z.string(), when: z.string(), note: z.string(), imageAlt: z.string().optional() }));
const trFormats = trData('formats', z.object({ name: z.string().optional(), note: z.string() }));
const trGlossary = trData('glossary', z.object({ term: z.string(), def: z.string() }));
const trSources = trData('sources', z.object({ label: z.string().optional(), note: z.string().optional() }));

export const collections = {
  entries, makers, physics, families, eras, milestones, formats, glossary, sources,
  trEntries, trMakers, trPhysics, trFamilies, trEras, trMilestones, trFormats, trGlossary, trSources,
};
