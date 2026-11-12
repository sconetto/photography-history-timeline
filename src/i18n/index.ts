/** Interface strings and locale-aware formatting, shared by server pages and client scripts. */
import en from './ui/en';
import ptBr from './ui/pt-br';
import { LOCALES, langFromPath, langFromHtml, type Lang } from './locales';

export * from './locales';
export type Key = keyof typeof en;
export type Vars = Record<string, string | number>;
export type T = (key: Key, vars?: Vars) => string;

const DICTS: Record<Lang, Record<Key, string>> = { en, 'pt-br': ptBr };

/** A lookup for one language: t('nav.timeline'), t('makers.count', { n: 3 }). Unknown {vars} are left as they are. */
export function useT(lang: Lang): T {
  const d = DICTS[lang];
  return (key, vars) => {
    const s = d[key] ?? en[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
  };
}

/** The language of the page being rendered (server) from its URL. */
export const pageLang = (astro: { url: URL }): Lang => langFromPath(astro.url.pathname);
/** The language of the current document (client). */
export const docLang = (): Lang => langFromHtml(document.documentElement.lang);

/** Numbers in the reader's convention: 1.5 → "1,5" in Portuguese. Years are never grouped. */
export function fmtNum(lang: Lang, n: number, digits = 0, minDigits = 0): string {
  return new Intl.NumberFormat(LOCALES[lang].htmlLang, { maximumFractionDigits: digits, minimumFractionDigits: minDigits, useGrouping: Math.abs(n) >= 10000 }).format(n);
}
/** A year for axes and labels: -400 → "400 BCE" / "400 a.C.". */
export function fmtYear(lang: Lang, y: number): string {
  return y < 0 ? `${-y} ${DICTS[lang]['year.bce']}` : String(Math.round(y));
}
/** An image licence as written in the content ("Public domain", "CC0"), in the reader's language. */
export function fmtLicense(lang: Lang, license: string): string {
  return /^public domain$/i.test(license) ? DICTS[lang]['license.pd'] : license;
}
/** A logo era such as "1955–today" or "2000s–today" in the reader's language ("anos 2000–hoje"). */
export function fmtEra(lang: Lang, era: string): string {
  if (lang === 'en') return era;
  return era.replace(/\btoday\b/g, DICTS[lang]['year.today']).replace(/\b(\d{4})s\b/g, lang === 'pt-br' ? 'anos $1' : '$1s');
}
/** "A, B and C" in the reader's language. */
export function fmtList(lang: Lang, items: string[]): string {
  return new Intl.ListFormat(LOCALES[lang].htmlLang, { type: 'conjunction' }).format(items);
}
