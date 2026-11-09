# Photography Through Time

An interactive history of photography, from the camera obscura to computational photography: one
star-chart timeline of the discoveries, processes, cameras, formats and companies that made the
medium, with a page for each and primers on the physics behind them.

**Live site:** [ptt.sconetto.me](https://ptt.sconetto.me)

![The Photography Through Time home page: a star-chart timeline of 103 entries above and below a yellow time band](docs/preview.png)

## What's inside

- **Timeline.** Every entry is a star on one line of time. Stars above the band are discoveries and
  inventions; stars below are cameras, formats and products. Star size shows impact, fill shows
  whether it is still in use, and lines show what built on what. Hover a star for a summary and its
  lineage; click it to open the full entry. Zoom into any period from the overview strip under the
  chart (drag across it, or pick an era), with ctrl-scroll or pinch, or with the + and − keys; the
  overview always shows which part of the timeline is in view. There are also by-family lanes and a
  list view.
- **Entries.** Each entry tells how it began, how it works, why it mattered and what replaced it, with
  key dates, people, specs, the frame drawn to scale and sources.
- **Makers.** A lifespan chart of camera and film companies by country, with the mergers, takeovers and
  sales that link them (Minolta → Konica Minolta → Sony, Pentax → Hoya → Ricoh and more).
- **Formats.** Film and sensor sizes from 8×10 inch to phone sensors, overlaid to scale, with a crop
  factor and equivalent focal length calculator.
- **How it works.** Nine primers on the physics and chemistry of photography, from the pinhole to
  computational photography, each with an interactive diagram: angle of view, depth of field, the
  exposure triangle, colour mixing and white balance, a Bayer sensor, burst stacking and more.
- **Landmarks, glossary and search.** Turning points in photography, a glossary of terms used across
  the site, and full-text search.

Four colour palettes (Kodachrome, Print & Darkroom, Cyanotype, Platinum & Selenium), each in day and
night modes. The whole site is in English and Brazilian Portuguese
([ptt.sconetto.me/pt-br/](https://ptt.sconetto.me/pt-br/)).

## Status

Live. The site has 103 entries, 35 makers and nine primers, with public-domain photographs on the
landmarks and 24 entries, and a drawing of every camera. Dates, names, firsts and specs have been
fact-checked against Eder's and Newhall's histories and the sources cited on each page. Every page is
checked with axe in day and night modes, works by keyboard, and fits a 375px phone screen without sideways
scrolling. Corrections are always welcome (see [Contributing](#contributing)).

## Development

Requires Node 26 (see `.nvmrc`) and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev        # local dev server
pnpm build      # static build into dist/, plus the Pagefind search index
pnpm preview    # serve the build at http://localhost:4321
pnpm check      # type check
pnpm test       # unit tests (Vitest)
pnpm e2e        # end-to-end and accessibility tests (Playwright + axe, against pnpm preview)
pnpm links      # check every external link in the content
pnpm i18n:status  # list anything not yet translated, per language
pnpm wiki:langlinks [lang] [--write]  # link translations to their own Wikipedia (see Languages)
```

Built with [Astro](https://astro.build), TypeScript, MDX and [Pagefind](https://pagefind.app), with
no client-side UI framework.

## Deployment

The site is static and hosted on GitHub Pages at the custom domain `ptt.sconetto.me`.

- **`.github/workflows/deploy.yml`** runs on every push to `main`: type check, unit tests, the
  translation check (`pnpm i18n:status`) and build, then publishes `dist/` to Pages. Pull requests run the same checks without deploying.
- **`.github/workflows/links.yml`** runs `pnpm links` every Monday, and on demand, so dead source
  links show up as a failed run.

The domain is a DNS `CNAME` record from `ptt` to `sconetto.github.io`, set in the repository's Pages
settings (source: GitHub Actions) with HTTPS enforced. `public/CNAME` records the domain too.

## Content

All content lives in `src/content/`:

| Path | What it holds |
|---|---|
| `entries/*.mdx` | One file per timeline entry: frontmatter for dates, family, impact, lineage and specs, and an MDX body with the narrative sections |
| `makers/*.md` | Companies, with founding and end dates and lineage links |
| `physics/*.mdx` | The "How it works" primers |
| `*.yaml` | Eras, families, formats, glossary, landmarks and general sources |

The build refuses bad data. It fails on an unknown reference, a child dated before its parent, a
missing narrative section, an image without credit and licence, a broken `[[wikilink]]`, or a link to
a blocklisted domain. Inside text, `[[id]]` links an entry, `[[m:id]]` a maker, `[[p:id]]` a primer and
`[[g:term]]` a glossary term.

### Sources

Entries cite their sources on each page; general references are on the Sources page. Text is written
fresh and paraphrased from those sources, never copied. Copyrighted books are used for fact-checking
and cited paraphrase only, and are kept out of the repository in the git-ignored `references/` folder.
Images are public domain (or CC0), each credited with its source. `node scripts/commons.ts` searches
Wikimedia Commons, refuses any file that is not public domain, and saves a scaled copy with its
credit. Cameras are drawn for this site as SVG, one per camera at its real proportions, not photographed.

## Languages

English is served at the root and every other language under its own prefix: `/pt-br/` for Brazilian
Portuguese. Paths and ids are the same in every language (`/entries/daguerreotype/` and
`/pt-br/entries/daguerreotype/`), so the language switcher in the header only swaps the prefix. There
is no automatic language detection.

Facts live only in the English files: dates, lineage, makers, specs, images and links. A translation
holds only words, in `src/content/i18n/<lang>/`, with the same file names and YAML keys as the English
content:

| Path | What it translates |
|---|---|
| `entries/*.mdx` | Title, label, dates as text, summary, "Today", people's roles, moments, specs, image alt text and the narrative, with the four section headings in that language |
| `makers/*.md` | Fate, link notes and the story |
| `physics/*.mdx` | Title, short description and the primer text |
| `*.yaml` | The words of each era, family, format, glossary term, landmark and source |

Interface text (menus, buttons, chart labels, widget readouts) lives in `src/i18n/ui/<lang>.ts`. The
English file is the source of truth, and `pnpm check` fails if another language is missing a key.
`src/i18n/TERMS.md` records the Portuguese photography terms chosen, so the translation stays
consistent. In translated text, wikilinks need a label in that language (`[[daguerreotype|daguerreótipo]]`);
`[[g:term]]` picks up the translated glossary term by itself, and all links stay in the same language.

**Wikipedia links.** A translated entry or maker can set its own `wiki:` title, and its page then
links to that language's Wikipedia instead of the English article marked "(em inglês)".
`pnpm wiki:langlinks pt-br` sets these only when it is sure the two are the same article. It follows the
English article's interlanguage link (from the shared Wikidata item), and the other-language article
must link back to the same English article. It skips redirects, disambiguation pages, and English links
that land on a section of a broader article. Run it without flags to see what could be added, and with
`--write` to add it. It also re-checks links already set and fails if one no longer matches.

**To add a language:**

1. Add it to `LANGS` and `LOCALES` in `src/i18n/locales.ts`, and to the sitemap `locales` in
   `astro.config.mjs`.
2. Copy `src/i18n/ui/en.ts` to `src/i18n/ui/<lang>.ts`, translate it, and register it in
   `src/i18n/index.ts`.
3. Translate the content into `src/content/i18n/<lang>/`. Pages are generated for the new prefix
   automatically, and Pagefind builds a separate search index for it.
4. Run `pnpm i18n:status` until it reports the language complete, then `pnpm wiki:langlinks <lang> --write`. The build also fails on a
   translation with no English original, or an entry missing one of its sections.

## Contributing

Corrections and additions are welcome: open an issue or a pull request. Commits follow
[Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): short description`, with
a bulleted body and a `Signed-off-by` line). Please run `pnpm check`, `pnpm test` and `pnpm build`
before opening a pull request.

## Acknowledgements

Inspired by the star-chart design of *Politics Through Time*
([petrogko/politics-history-timeline](https://github.com/petrogko/politics-history-timeline)). This
project shares its ideas but none of its code.

## License

Copyright © 2026 João Pedro Sconetto.

This project is free software: you can redistribute it and/or modify it under the terms of the
[GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version.

It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE)
file for details.

Public-domain images keep their public-domain status. Company and product names are trademarks of
their owners and are used only to describe their history.
