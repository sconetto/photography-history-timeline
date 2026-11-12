import { describe, expect, it } from 'vitest';
import { useT, fmtNum, fmtYear, fmtList, pathIn, stripLang, langFromPath, langFromHtml, langPaths, type Key } from '../../src/i18n';
import en from '../../src/i18n/ui/en';
import ptBr from '../../src/i18n/ui/pt-br';
import { validateTranslations } from '../../src/lib/validate';
import { resolve, langOfFile, type Targets } from '../../src/plugins/remark-wikilinks';

describe('dictionaries', () => {
  it('pt-br has every English key and no extras', () => {
    expect(Object.keys(ptBr).sort()).toEqual(Object.keys(en).sort());
  });
  it('pt-br uses only {placeholders} the English string provides', () => {
    // a translation may leave one out (e.g. to avoid gendering a company name) but never invent one
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    for (const k of Object.keys(en) as Key[]) for (const v of vars(ptBr[k])) expect(vars(en[k]), `${k}: {${v}}`).toContain(v);
  });
});

describe('t()', () => {
  it('looks up and interpolates', () => {
    const t = useT('pt-br');
    expect(t('entry.how.began')).toBe('Como começou');
    expect(useT('en')('entry.how.began')).toBe('How it began');
    const key = (Object.keys(en) as Key[]).find((k) => en[k].includes('{'))!;
    const name = /\{(\w+)\}/.exec(en[key])![1];
    expect(useT('en')(key, { [name]: 'XYZ' })).toContain('XYZ');
    expect(useT('en')(key, { other: 1 })).toContain(`{${name}}`);
  });
});

describe('formatting', () => {
  it('formats years with the local era name', () => {
    expect(fmtYear('en', -400)).toBe('400 BCE');
    expect(fmtYear('pt-br', -400)).toBe('400 a.C.');
    expect(fmtYear('pt-br', 1839)).toBe('1839');
  });
  it('uses a decimal comma in Portuguese', () => {
    expect(fmtNum('pt-br', 1.5, 1)).toBe('1,5');
    expect(fmtNum('en', 1.5, 1)).toBe('1.5');
    expect(fmtNum('pt-br', 2.8, 1, 1)).toBe('2,8');
    expect(fmtNum('pt-br', 1839)).toBe('1839');
  });
  it('joins lists in the reader’s language', () => {
    expect(fmtList('pt-br', ['A', 'B', 'C'])).toBe('A, B e C');
  });
});

describe('paths', () => {
  it('round-trips between languages', () => {
    for (const p of ['/', '/entries/daguerreotype/', '/formats/']) {
      const pt = pathIn('pt-br', p);
      expect(pt).toBe(`/pt-br${p}`);
      expect(langFromPath(pt)).toBe('pt-br');
      expect(stripLang(pt)).toBe(p);
      expect(pathIn('en', pt)).toBe(p);
      expect(pathIn('pt-br', pt)).toBe(pt);
    }
    expect(stripLang('/pt-br')).toBe('/');
    expect(langFromPath('/pt-break/')).toBe('en');
  });
  it('reads <html lang>', () => {
    expect(langFromHtml('pt-BR')).toBe('pt-br');
    expect(langFromHtml('en')).toBe('en');
    expect(langFromHtml('fr')).toBe('en');
  });
  it('builds one route per language', () => {
    expect(langPaths().map((p) => p.params.lang)).toEqual([undefined, 'pt-br']);
  });
});

describe('wikilinks in translations', () => {
  const targets: Targets = { entries: new Set(['daguerreotype']), makers: new Set(['kodak']), physics: new Set(['silver']), glossary: new Map([['fixer', 'fixador']]), prefix: '/pt-br' };
  it('reads the language from the file path', () => {
    expect(langOfFile('/x/src/content/i18n/pt-br/entries/ccd.mdx')).toBe('pt-br');
    expect(langOfFile('/x/src/content/entries/ccd.mdx')).toBe('');
  });
  it('prefixes links and uses the translated glossary term', () => {
    expect(resolve(targets, undefined, 'daguerreotype', 'daguerreótipo')).toMatchObject({ url: '/pt-br/entries/daguerreotype/', text: 'daguerreótipo' });
    expect(resolve(targets, 'm', 'kodak', 'Kodak')!.url).toBe('/pt-br/makers/kodak/');
    expect(resolve(targets, 'p', 'silver', 'prata')!.url).toBe('/pt-br/physics/silver/');
    expect(resolve(targets, 'g', 'fixer')).toMatchObject({ url: '/pt-br/glossary/#fixer', text: 'fixador' });
    expect(resolve(targets, undefined, 'nope', 'x')).toBeNull();
  });
});

describe('validateTranslations', () => {
  const t = useT('pt-br');
  const sections = [t('entry.how.began'), t('entry.how.works'), t('entry.how.mattered'), t('entry.how.limits')];
  const known = { entry: new Set(['ccd']), maker: new Set(['kodak']), primer: new Set(['silver']), data: new Set(['fixer']) };
  const body = sections.map((s) => `## ${s}\n\ntexto\n`).join('\n');
  it('accepts a complete translation', () => {
    expect(validateTranslations([{ where: 'ccd.mdx', kind: 'entry', id: 'ccd', body }], known, sections)).toEqual([]);
  });
  it('rejects an orphan translation', () => {
    expect(validateTranslations([{ where: 'x.md', kind: 'maker', id: 'nikonn' }], known, sections)).toEqual([expect.stringContaining('no English maker "nikonn"')]);
  });
  it('rejects a missing Portuguese section', () => {
    const p = validateTranslations([{ where: 'ccd.mdx', kind: 'entry', id: 'ccd', body: body.replace('## Como funciona', '## How it works') }], known, sections);
    expect(p).toEqual([expect.stringContaining('missing "## Como funciona"')]);
  });
});

describe('fmtEra', () => {
  it('translates "today" and decades for pt-br and leaves English alone', async () => {
    const { fmtEra } = await import('../../src/i18n');
    expect(fmtEra('en', '2000s–today')).toBe('2000s–today');
    expect(fmtEra('pt-br', '2000s–today')).toBe('anos 2000–hoje');
    expect(fmtEra('pt-br', '1955–today')).toBe('1955–hoje');
  });
});
