import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const errorsOn = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
};
const dot = (page: Page, id: string) => page.locator(`#chart a.item[data-id="${id}"] circle.dot`);

test('home renders every star with no console errors', async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto('/');
  const n = await page.locator('#listwrap tbody tr').count();
  expect(n).toBeGreaterThan(30);
  await expect(page.locator('#chart a.item')).toHaveCount(n);
  expect(errors).toEqual([]);
});

test('hover shows the card and traces lineage without navigating', async ({ page }) => {
  await page.goto('/');
  await dot(page, 'daguerreotype').hover();
  await expect(page.locator('#card')).toBeVisible();
  await expect(page.locator('#card')).toContainText('daguerreotype');
  await expect(page.locator('#chart')).toHaveClass(/tracing/);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('every star dot is clickable to its own entry', async ({ page }) => {
  await page.goto('/');
  const covered = await page.evaluate(() => [...document.querySelectorAll<SVGAElement>('#chart a.item')].filter((a) => {
    a.scrollIntoView({ block: 'center', inline: 'center' });
    const r = a.querySelector('circle.dot')!.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a') !== (a as Element);
  }).map((a) => a.dataset.id));
  expect(covered).toEqual([]);
});

test('click navigates to the entry page', async ({ page }) => {
  await page.goto('/');
  await dot(page, 'daguerreotype').click();
  await expect(page).toHaveURL(/\/entries\/daguerreotype\/$/);
  await expect(page.locator('h1')).toContainText('daguerreotype');
});

test('Enter on a focused star navigates', async ({ page }) => {
  await page.goto('/');
  await page.locator('#chart a.item[data-id="nikon-f"]').focus();
  await expect(page.locator('#card')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/entries\/nikon-f\/$/);
});

test('hash deep link selects and highlights a star', async ({ page }) => {
  await page.goto('/#nikon-f');
  await expect(page.locator('#chart a.item[data-id="nikon-f"]')).toHaveClass(/sel/);
});

test('views switch and persist via hash', async ({ page }) => {
  await page.goto('/#lanes');
  await expect(page.locator('#lanes-svg')).toBeVisible();
  await page.goto('/#list');
  await expect(page.locator('#listwrap')).toBeVisible();
});

test('theme persists across reloads', async ({ page }) => {
  await page.goto('/');
  await page.locator('details.palette summary').click();
  await page.getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('header stays on one row at every width', async ({ page }) => {
  await page.goto('/entries/');
  for (const width of [1920, 1440, 1280, 1141, 1140, 1024, 768, 560, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const r = await page.evaluate(() => {
      const kids = [...document.querySelectorAll('.site-head .row > *')].filter((e) => getComputedStyle(e).display !== 'none');
      const mids = kids.map((e) => { const b = e.getBoundingClientRect(); return b.top + b.height / 2; });
      return { spread: Math.max(...mids) - Math.min(...mids), scrollW: document.documentElement.scrollWidth };
    });
    expect(r.spread, `header rows at ${width}px`).toBeLessThan(6);
    expect(r.scrollW, `page width at ${width}px`).toBeLessThanOrEqual(width);
  }
});

test('menu button opens the nav on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/');
  const nav = page.locator('#site-nav');
  const btn = page.getByRole('button', { name: 'Menu' });
  await expect(nav).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(btn).toBeFocused();
  await btn.click();
  await nav.getByRole('link', { name: 'Formats' }).click();
  await expect(page).toHaveURL(/\/formats\/$/);
});

test('palette defaults to Kodachrome and persists across reloads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'kodachrome');
  await page.locator('details.palette summary').click();
  await page.getByText('Cyanotype', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'cyanotype');
  await expect(page.locator('details.palette')).not.toHaveAttribute('open', '');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'cyanotype');
  await expect(page.locator('details.palette .cur-name')).toHaveText('Cyanotype');
});

const PALETTES = ['kodachrome', 'print', 'cyanotype', 'platinum'];
for (const pal of PALETTES) for (const mode of ['day', 'night']) {
  test(`no serious axe violations: ${pal} ${mode}`, async ({ page }) => {
    await page.addInitScript(([p, m]) => { localStorage.setItem('ptt-palette', p); localStorage.setItem('ptt-theme', m); }, [pal, mode]);
    for (const path of ['/', '/entries/daguerreotype/']) {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    }
  });
}

for (const path of ['/', '/entries/', '/entries/daguerreotype/', '/makers/', '/formats/', '/physics/', '/glossary/', '/landmarks/', '/sources/']) {
  test(`no serious axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } });

  test('first tap previews, second tap opens', async ({ page }) => {
    await page.goto('/');
    const d = dot(page, 'leica-i');
    await d.scrollIntoViewIfNeeded();
    await d.tap();
    await expect(page.locator('#card')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
    await d.tap();
    await expect(page).toHaveURL(/\/entries\/leica-i\/$/);
  });

  test('no horizontal page scroll at 375px', async ({ page }) => {
    for (const path of ['/', '/entries/daguerreotype/', '/formats/']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(375);
    }
  });
});
