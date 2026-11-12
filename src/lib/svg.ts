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
  s = addViewBox(s.trim());
  const problems: string[] = [];
  if (!/^<svg[\s>]/i.test(s)) problems.push('does not start with <svg>');
  for (const [re, what] of [
    [/<script/i, 'a script'], [/<foreignObject/i, 'embedded HTML'], [/\son[a-z]+\s*=/i, 'an event handler'],
    [/javascript:/i, 'a javascript: URL'], [/<!ENTITY/i, 'an entity declaration'], [/<(iframe|embed|object)\b/i, 'an embedded frame'],
    [/(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)/i, 'an external link'],
  ] as const) if (re.test(s)) problems.push(`still contains ${what}`);
  if (/^<svg[\s>]/i.test(s) && !/^<svg\b[^>]*\bviewBox=/i.test(s) && /^<svg\b[^>]*\b(width|height)=/i.test(s)) {
    problems.push('has no viewBox and a width or height in units other than px, so it will not scale');
  }
  return { svg: s + '\n', problems };
}

/**
 * An SVG without a viewBox does not scale: shown smaller or larger than its width and height, its drawing keeps
 * its own size and is cropped or left in a corner. Commons files often lack one, so add `0 0 width height`
 * when both are plain numbers (or px), which is the coordinate system such a file already draws in.
 */
function addViewBox(s: string): string {
  const m = s.match(/^<svg\b[^>]*>/i);
  if (!m || /\bviewBox=/i.test(m[0])) return s;
  const num = (a: string) => m[0].match(new RegExp(`\\s${a}\\s*=\\s*["']\\s*([\\d.]+)\\s*(?:px)?\\s*["']`, 'i'))?.[1];
  const w = num('width'), h = num('height');
  if (!w || !h) return s;
  const tag = m[0].replace(/\s*(\/?)>$/, ` viewBox="0 0 ${Number(w)} ${Number(h)}"$1>`);
  return tag + s.slice(m[0].length);
}
