/** Prefix internal paths with the configured base (empty at ptt.sconetto.me, but keeps subpath hosting working). */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
