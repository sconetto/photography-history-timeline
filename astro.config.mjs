// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkWikilinks from './src/plugins/remark-wikilinks.ts';

export default defineConfig({
  site: 'https://ptt.sconetto.me',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // unified (remark) processor so our wikilink plugin runs on .md and .mdx (MDX inherits it)
  markdown: { processor: unified({ remarkPlugins: [remarkWikilinks] }) },
  // the sitemap lists every page with its other-language versions (hreflang); keep in step with src/i18n/locales.ts
  integrations: [mdx(), sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', 'pt-br': 'pt-BR' } } })],
});
