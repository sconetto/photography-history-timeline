/** Domains never linked from the site: pirate or mirror PDF sites, and sites that block link checks. No imports, so plain Node scripts can use it. */
export const BLOCKED_DOMAINS = ['morepdf.online', 'pdfdrive.com', 'libgen', 'z-lib', 'zlibrary', 'annas-archive', 'scribd.com', 'britannica.com', 'dokumen.pub', 'epdf.pub', 'vdoc.pub'];

export function blocked(url: string): string | undefined {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return 'malformed URL'; }
  return BLOCKED_DOMAINS.find((d) => host === d || host.endsWith('.' + d) || host.includes(d));
}
