/**
 * The site's languages. English is served at the root, every other language under its own prefix (/pt-br/…);
 * paths and ids stay the same in every language, so switching language only swaps the prefix.
 * To add a language: add it here, add src/i18n/ui/<lang>.ts, and translate content into src/content/i18n/<lang>/.
 */
export const LANGS = ['en', 'pt-br'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

export const LOCALES: Record<Lang, { prefix: string; htmlLang: string; label: string; short: string; og: string }> = {
  en: { prefix: '', htmlLang: 'en', label: 'English', short: 'EN', og: 'en_GB' },
  'pt-br': { prefix: '/pt-br', htmlLang: 'pt-BR', label: 'Português (Brasil)', short: 'PT', og: 'pt_BR' },
};

const PREFIXED = LANGS.filter((l) => LOCALES[l].prefix);

/** The language a site path belongs to. */
export function langFromPath(path: string): Lang {
  return PREFIXED.find((l) => path === LOCALES[l].prefix || path.startsWith(`${LOCALES[l].prefix}/`)) ?? DEFAULT_LANG;
}
/** A site path without its language prefix: /pt-br/entries/x/ → /entries/x/. */
export function stripLang(path: string): string {
  const p = LOCALES[langFromPath(path)].prefix;
  return p ? path.slice(p.length) || '/' : path;
}
/** The same page in another language. Keeps the query and hash. */
export function pathIn(lang: Lang, path: string): string {
  return LOCALES[lang].prefix + stripLang(path);
}
/** The language of an <html lang> value (pt-BR → pt-br). */
export function langFromHtml(htmlLang: string): Lang {
  return LANGS.find((l) => LOCALES[l].htmlLang.toLowerCase() === htmlLang.toLowerCase()) ?? DEFAULT_LANG;
}
/** getStaticPaths params for the optional [...lang] route segment: undefined for English, 'pt-br' for Portuguese. */
export const langPaths = () => LANGS.map((lang) => ({ params: { lang: LOCALES[lang].prefix ? LOCALES[lang].prefix.slice(1) : undefined }, props: { lang } }));
