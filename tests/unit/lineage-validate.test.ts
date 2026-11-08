import { describe, expect, it } from 'vitest';
import { lineage, findCycle } from '../../src/lib/lineage';
import { validate, blocked, REQUIRED_SECTIONS } from '../../src/lib/validate';
import { resolve, type Targets } from '../../src/plugins/remark-wikilinks';

const nodes = [
  { id: 'a', parents: [] },
  { id: 'b', parents: [{ id: 'a', kind: 'built' }] },
  { id: 'c', parents: [{ id: 'b', kind: 'built' }] },
  { id: 'd', parents: [{ id: 'a', kind: 'enabled' }] },
];
const body = REQUIRED_SECTIONS.map((s) => `## ${s}\n\ntext\n`).join('\n');
const entry = (id: string, year: number, parents: { id: string; kind: string }[] = [], extra = {}) => ({ id, year, parents, body, urls: [], ...extra });

describe('lineage', () => {
  it('finds ancestors and descendants', () => {
    const L = lineage(nodes, 'b');
    expect([...L.up].sort()).toEqual(['a', 'b']);
    expect([...L.down].sort()).toEqual(['b', 'c']);
  });
  it('detects cycles', () => {
    expect(findCycle(nodes)).toEqual([]);
    expect(findCycle([{ id: 'x', parents: [{ id: 'y', kind: 'built' }] }, { id: 'y', parents: [{ id: 'x', kind: 'built' }] }]).length).toBeGreaterThan(0);
  });
});

describe('validate', () => {
  it('passes good data', () => {
    expect(validate({ entries: [entry('a', 1800), entry('b', 1850, [{ id: 'a', kind: 'built' }])], makers: [], otherUrls: [] })).toEqual([]);
  });
  it('rejects a child dated before its parent', () => {
    const p = validate({ entries: [entry('a', 1900), entry('b', 1850, [{ id: 'a', kind: 'built' }])], makers: [], otherUrls: [] });
    expect(p.join()).toMatch(/earlier than its parent/);
  });
  it('rejects unknown parents, bad ids and missing sections', () => {
    const p = validate({ entries: [entry('Bad_ID', 1900, [{ id: 'ghost', kind: 'built' }], { body: '## How it began\n' })], makers: [], otherUrls: [] }).join('\n');
    expect(p).toMatch(/unknown parent ghost/);
    expect(p).toMatch(/kebab-case/);
    expect(p).toMatch(/missing "## How it works"/);
  });
  it('rejects blocked domains', () => {
    expect(blocked('https://morepdf.online/look-up/x')).toBeTruthy();
    expect(blocked('https://www.britannica.com/x')).toBeTruthy();
    expect(blocked('https://www.loc.gov/x')).toBeUndefined();
    const p = validate({ entries: [entry('a', 1800, [], { urls: ['https://morepdf.online/x'] })], makers: [], otherUrls: [] });
    expect(p.join()).toMatch(/blocked domain/);
  });
  it('checks maker links: target exists, dates fit, and a merger ends the company', () => {
    const ok = validate({ entries: [], otherUrls: [], makers: [
      { id: 'konica', founded: 1873, ended: 2003, urls: [], links: [{ to: 'km', year: 2003, kind: 'merged' }] },
      { id: 'km', founded: 2003, urls: [] }] });
    expect(ok).toEqual([]);
    const bad = validate({ entries: [], otherUrls: [], makers: [
      { id: 'a', founded: 1900, urls: [], links: [{ to: 'ghost', year: 1950, kind: 'sold' }, { to: 'b', year: 1950, kind: 'merged' }] },
      { id: 'b', founded: 1960, urls: [] }] }).join('\n');
    expect(bad).toMatch(/unknown maker "ghost"/);
    expect(bad).toMatch(/b was founded in 1960/);
    expect(bad).toMatch(/"ended" should be 1950/);
  });

  it('rejects makers that end before they start', () => {
    expect(validate({ entries: [], makers: [{ id: 'm', founded: 1950, ended: 1900, urls: [] }], otherUrls: [] }).join()).toMatch(/ended before/);
  });
});

describe('wikilinks', () => {
  const t: Targets = { entries: new Set(['daguerreotype']), makers: new Set(['kodak']), physics: new Set(['pinhole']), glossary: new Map([['f-number', 'f-number']]) };
  it('resolves each prefix', () => {
    expect(resolve(t, undefined, 'daguerreotype')?.url).toBe('/entries/daguerreotype/');
    expect(resolve(t, 'm', 'kodak')?.url).toBe('/makers/kodak/');
    expect(resolve(t, 'p', 'pinhole', 'Pinholes')?.text).toBe('Pinholes');
    expect(resolve(t, 'g', 'f-number')?.cls).toBe('gloss');
  });
  it('returns null for unknown targets', () => {
    expect(resolve(t, undefined, 'nope')).toBeNull();
    expect(resolve(t, 'g', 'nope')).toBeNull();
  });
});
