import { describe, expect, it } from 'vitest';
import { validate, validateTranslations, missingSections, licenseOk, MAKER_SECTIONS, REQUIRED_SECTIONS, type VMaker } from '../../src/lib/validate';
import { cleanSvg } from '../../src/lib/svg';

const story = (heads = ['Beginnings', 'Growth and turning points', 'What it made', 'Today']) => heads.map((h) => `## ${h}\n\ntext\n`).join('\n');
const entries = [{ id: 'ae-1', year: 1976, parents: [], urls: [], makers: ['canon'], body: REQUIRED_SECTIONS.map((h) => `## ${h}\n\ntext\n`).join('\n') }];
const maker = (extra: Partial<VMaker> = {}): VMaker => ({ id: 'canon', founded: 1937, urls: [], body: story(), highlights: [{ id: 'ae-1', year: 1976, entry: 'ae-1' }], ...extra });
const run = (makers: VMaker[]) => validate({ entries, makers, otherUrls: [] });

describe('maker stories and highlights', () => {
  it('accepts a complete maker', () => {
    expect(run([maker()])).toEqual([]);
  });
  it('accepts "Legacy" in place of "Today"', () => {
    expect(missingSections(story(['Beginnings', 'Growth and turning points', 'What it made', 'Legacy']), MAKER_SECTIONS)).toEqual([]);
  });
  it('requires the sections once a maker has highlights', () => {
    expect(run([maker({ body: story(['Beginnings', 'What it made', 'Today']) })])).toEqual(['maker canon: missing "## Growth and turning points" section']);
    expect(run([maker({ body: 'short story', highlights: [] })])).toEqual([]);
  });
  it('rejects duplicate highlight ids', () => {
    expect(run([maker({ highlights: [{ id: 'f-1', year: 1971 }, { id: 'f-1', year: 1981 }] })])).toEqual(['maker canon: highlight "f-1" appears twice']);
  });
  it('rejects a highlight older than the company or its predecessors', () => {
    expect(run([maker({ highlights: [{ id: 'kwanon', year: 1934 }] })])).toEqual([expect.stringContaining('older than the company (1937)')]);
    const pre: VMaker = { id: 'precision', founded: 1933, ended: 1937, urls: [], links: [{ to: 'canon', year: 1937, kind: 'renamed' }] };
    expect(run([pre, maker({ highlights: [{ id: 'kwanon', year: 1934 }] })])).toEqual([]);
  });
  it('checks a highlight against its entry', () => {
    expect(run([maker({ highlights: [{ id: 'ae-1', year: 1977, entry: 'ae-1' }] })])).toEqual([expect.stringContaining('entry ae-1 is 1976')]);
    expect(run([maker({ highlights: [{ id: 'x', year: 1976, entry: 'nope' }] })])).toEqual([expect.stringContaining('unknown entry "nope"')]);
    expect(validate({ entries: [{ ...entries[0], makers: ['nikon'] }], makers: [maker()], otherUrls: [] })).toEqual([expect.stringContaining('does not list canon')]);
  });
  it('accepts only public-domain and CC0 images', () => {
    expect(['Public domain', 'PD-textlogo', 'CC0', 'cc0 1.0'].every(licenseOk)).toBe(true);
    expect(['CC BY-SA 4.0', 'CC BY 2.0', 'Copyrighted', 'GFDL'].some(licenseOk)).toBe(false);
    expect(validate({ entries: [], makers: [], otherUrls: [], images: [{ where: 'maker x logo', license: 'CC BY-SA 3.0' }] })).toEqual([expect.stringContaining('not public domain or CC0')]);
  });
});

describe('maker translations', () => {
  const pt = [['Origens'], ['Crescimento e viradas'], ['O que fabricou'], ['Hoje', 'Legado']];
  const known = { entry: new Set<string>(), maker: new Set(['canon']), primer: new Set<string>(), data: new Set<string>() };
  const makers = { highlights: new Map([['canon', ['ae-1', 'f-1']]]), sections: pt };
  const body = pt.map((s) => `## ${s[0]}\n\ntexto\n`).join('\n');
  const check = (highlights: string[], b = body) => validateTranslations([{ where: 'pt-br/makers/canon', kind: 'maker', id: 'canon', body: b, highlights }], known, [], makers);
  it('accepts a complete translation', () => expect(check(['ae-1', 'f-1'])).toEqual([]));
  it('rejects a missing or unknown highlight', () => {
    expect(check(['ae-1'])).toEqual(['pt-br/makers/canon: highlight "f-1" is not translated']);
    expect(check(['ae-1', 'f-1', 'f-2'])).toEqual(['pt-br/makers/canon: no English highlight "f-2" to translate']);
  });
  it('requires the Portuguese sections', () => {
    expect(check(['ae-1', 'f-1'], body.replace('## Origens', '## Beginnings'))).toEqual(['pt-br/makers/canon: missing "## Origens" section']);
  });
});

describe('cleanSvg', () => {
  it('keeps a plain logo', () => {
    const r = cleanSvg('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="#c00"/></svg>');
    expect(r.problems).toEqual([]);
    expect(r.svg).toMatch(/^<svg[\s\S]*<path[\s\S]*<\/svg>\n$/);
  });
  it('removes scripts, handlers, embedded HTML and external references', () => {
    const r = cleanSvg(`<!DOCTYPE svg [<!ENTITY x "y">]><svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg">
      <script>alert(1)</script><foreignObject><div>hi</div></foreignObject>
      <style>@import url(https://evil.example/x.css); .a{fill:url(https://evil.example/p.svg#g)}</style>
      <use href="https://evil.example/s.svg#a"/><use xlink:href="#local"/><rect onclick="x()" fill="url(#grad)"/></svg>`);
    expect(r.problems).toEqual([]);
    expect(r.svg).not.toMatch(/script|onload|onclick|foreignObject|evil\.example|ENTITY/i);
    expect(r.svg).toContain('xlink:href="#local"');
    expect(r.svg).toContain('url(#grad)');
  });
  it('adds a viewBox so a logo scales, and refuses one it cannot size', () => {
    const r = cleanSvg('<svg xmlns="http://www.w3.org/2000/svg" width="563" height="171px"><path d="M0 0h9z"/></svg>');
    expect(r.problems).toEqual([]);
    expect(r.svg).toMatch(/^<svg [^>]*viewBox="0 0 563 171">/);
    expect(cleanSvg('<svg viewBox="0 0 4 2" width="40" height="20"/>').svg).toBe('<svg viewBox="0 0 4 2" width="40" height="20"/>\n');
    expect(cleanSvg('<svg width="240mm" height="45mm"><path d="M0 0h9z"/></svg>').problems).toContain('has no viewBox and a width or height in units other than px, so it will not scale');
  });
  it('refuses what it cannot clean', () => {
    expect(cleanSvg('<html><svg/></html>').problems).toContain('does not start with <svg>');
    expect(cleanSvg('<svg><iframe src="https://evil.example"></iframe></svg>').problems).toContain('still contains an embedded frame');
    // a javascript: link is removed rather than refused
    expect(cleanSvg('<svg><a href="javascript:alert(1)">x</a></svg>')).toEqual({ svg: '<svg><a>x</a></svg>\n', problems: [] });
  });
});
