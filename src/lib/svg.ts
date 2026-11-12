/**
 * Clean an SVG downloaded from Wikimedia Commons before it enters the repo. Logos are only ever shown with
 * <img> (where scripts never run), but the file should be safe however it is used later: no scripts, no event
 * handlers, no embedded HTML, no entity declarations and nothing fetched from elsewhere.
 * Returns the cleaned SVG and anything it could not clean; callers refuse a file with problems.
 */
export function cleanSvg(input: string): { svg: string; problems: string[] } {
  let s = input
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, '') // DOCTYPE, with any internal entity subset
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<foreignObject\b[^>]*\/>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '') // onload=, onclick=…
    // links: keep in-document references (#id) and embedded raster data, drop everything else
    .replace(/\s+(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, (m, v: string) => (/^["'](#|data:image\/(png|jpe?g|gif|webp);)/i.test(v) ? m : ''))
    .replace(/@import[^;]*;/gi, '')
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, 'none'); // CSS url(...) pointing outside the document
  s = s.trim();
  const problems: string[] = [];
  if (!/^<svg[\s>]/i.test(s)) problems.push('does not start with <svg>');
  for (const [re, what] of [
    [/<script/i, 'a script'], [/<foreignObject/i, 'embedded HTML'], [/\son[a-z]+\s*=/i, 'an event handler'],
    [/javascript:/i, 'a javascript: URL'], [/<!ENTITY/i, 'an entity declaration'], [/<(iframe|embed|object)\b/i, 'an embedded frame'],
    [/(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)/i, 'an external link'],
  ] as const) if (re.test(s)) problems.push(`still contains ${what}`);
  return { svg: s + '\n', problems };
}
