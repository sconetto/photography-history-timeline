/** Internal links: the configured base (empty at ptt.sconetto.me, but keeps subpath hosting working) plus the language prefix. */
import { LOCALES, DEFAULT_LANG, type Lang } from '../i18n/locales';
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string, lang: Lang = DEFAULT_LANG) => `${BASE}${LOCALES[lang].prefix}${path.startsWith('/') ? path : `/${path}`}`;
