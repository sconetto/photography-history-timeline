import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';

/** Every outbound link must be https. Domain blocklist checks live in src/lib/validate.ts. */
const https = z.string().refine((s) => s.startsWith('https://'), { message: 'links must start with https://' });
const link = z.tuple([z.string().min(1), https]);
const year = z.number().int().min(-1000).max(2100);

const FAMILIES = ['optics', 'chem', 'colour', 'cameras', 'formats', 'control', 'digital', 'sharing'] as const;
/** merged: both became a new company · acquired: bought outright · sold: sold its camera/film business ·
 *  renamed: same company, new name · stake: took a controlling stake, company carries on · revived: a new company restarted the product */
export const MAKER_LINKS = ['merged', 'acquired', 'sold', 'renamed', 'stake', 'revived'] as const;
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
      cameraType: z
        .enum(['box', 'folding', 'viewfinder', 'rangefinder', 'tlr', 'slr', 'view', 'instant', 'compact', 'dslr', 'mirrorless', 'phone'])
        .optional(),
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
  schema: z.object({
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

export const collections = { entries, makers, physics, families, eras, milestones, formats, glossary, sources };
