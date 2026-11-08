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
  await page.locator('details.palette').getByText('Cyanotype', { exact: true }).click();
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

for (const path of ['/', '/entries/', '/entries/daguerreotype/', '/makers/', '/makers/sony/', '/formats/', '/physics/', '/glossary/', '/landmarks/', '/sources/', '/search/']) {
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

test.describe('phase 2 views', () => {
  test('search finds Kodachrome, with a result type', async ({ page }) => {
    await page.goto('/search/');
    await page.locator('#search input').fill('Kodachrome');
    const first = page.locator('.pagefind-ui__result').first();
    await expect(first).toBeVisible();
    await expect(page.locator('.pagefind-ui__result-link[href="/entries/kodachrome/"]')).toBeVisible();
    await expect(page.locator('.pagefind-ui__filter-panel')).toContainText('Entry');
  });

  test('"/" opens search from any page', async ({ page }) => {
    await page.goto('/makers/');
    await page.keyboard.press('/');
    await expect(page).toHaveURL(/\/search\/$/);
  });

  test('makers chart draws every maker, its entries and merger links', async ({ page }) => {
    await page.goto('/makers/');
    const rows = page.locator('svg.mk .row');
    expect(await rows.count()).toBeGreaterThan(20);
    await expect(page.locator('svg.mk .link[data-from~="konica"][data-from~="minolta"][data-to="konica-minolta"]')).toHaveCount(1);
    await expect(page.locator('svg.mk .link[data-from="konica-minolta"][data-to="sony"]')).toHaveCount(1);
    // no entry dot hides behind another dot or a connector
    const covered = await page.evaluate(() => [...document.querySelectorAll('svg.mk a.pdot')].filter((a) => {
      a.scrollIntoView({ block: 'center' });
      const r = a.querySelector('circle')!.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a') !== (a as Element);
    }).map((a) => a.getAttribute('aria-label')));
    expect(covered).toEqual([]);
    await page.locator('svg.mk .row[data-id="nikon"] a.pdot').first().click();
    await expect(page).toHaveURL(/\/entries\/.+\/$/);
  });

  test('hovering a connector explains the change; touch previews first', async ({ page }) => {
    await page.goto('/makers/');
    const t = (await page.locator('svg.mk .link[data-to="sony"] .trunk').boundingBox())!;
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
    const tip = page.locator('#mk-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Konica Minolta sold its business to Sony');
    await expect(tip).toContainText('2006');
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
    await page.locator('svg.mk .row[data-id="kodak"] a.pdot').first().hover();
    await expect(tip).toContainText('open the entry');
  });

  test('on touch, the first tap on a connector previews and the second opens', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/makers/');
    const link = page.locator('svg.mk .link[data-to="harman"]');
    await link.scrollIntoViewIfNeeded();
    const t = (await link.locator('.trunk').boundingBox())!;
    await page.touchscreen.tap(t.x + t.width / 2, t.y + t.height / 2);
    await expect(page.locator('#mk-tip')).toContainText('Tap again');
    expect(new URL(page.url()).pathname).toBe('/makers/');
    await page.touchscreen.tap(t.x + t.width / 2, t.y + t.height / 2);
    await expect(page).toHaveURL(/\/makers\/harman\/$/);
    await ctx.close();
  });

  test('maker page shows its lineage in both directions', async ({ page }) => {
    await page.goto('/makers/sony/');
    await expect(page.locator('aside')).toContainText('Took over business of');
    await expect(page.locator('aside')).toContainText('Konica Minolta');
    await page.goto('/makers/minolta/');
    await expect(page.locator('aside')).toContainText('Merged into');
  });

  test('formats overlay zooms to the selected format and the calculator updates', async ({ page }) => {
    await page.goto('/formats/');
    const vb = () => page.locator('#ov').getAttribute('viewBox');
    const before = await vb();
    await page.selectOption('#fmt', '8x10');
    await expect.poll(async () => Number((await vb())!.split(' ')[2])).toBeGreaterThan(250);
    expect(await vb()).not.toBe(before);
    await expect(page.locator('#focal')).toHaveValue('325');
    await expect(page.locator('#out')).toContainText('normal lens');
    await page.locator('#focal').fill('50');
    await page.selectOption('#fmt', 'aps-c-canon');
    await expect(page.locator('#out')).toContainText('81 mm');
    await expect(page.locator('#focal')).toHaveValue('50');
  });

  test('glossary filter narrows terms and shows where each is used', async ({ page }) => {
    await page.goto('/glossary/');
    await page.locator('#gl-q').fill('crop');
    await expect(page.locator('.gl > div:visible')).toHaveCount(1);
    await expect(page.locator('#crop-factor .used a').first()).toBeVisible();
    await page.locator('#gl-q').fill('zzzz');
    await expect(page.locator('#gl-none')).toBeVisible();
  });
});

test.describe('timeline zoom', () => {
  const readout = async (page: Page) => {
    const t = (await page.locator('.nav-range').textContent()) ?? '';
    const m = /^(.+?) – (.+?) · ([\d.]+)×$/.exec(t);
    const yr = (s: string) => (s === 'today' ? new Date().getFullYear() : s.endsWith('BCE') ? -parseInt(s) : parseInt(s));
    expect(m, t).not.toBeNull();
    return { a: yr(m![1]), b: yr(m![2]), k: Number(m![3]) };
  };
  const chartW = (page: Page) => page.locator('#chart').evaluate((s) => Number(s.getAttribute('width')));
  const chartH = (page: Page) => page.locator('#chart').evaluate((s) => Number(s.getAttribute('height')));
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/');
    await expect(page.locator('.nav-range')).toContainText('1×');
  });

  test('zoom in widens the chart, narrows the window and keeps the centre', async ({ page }) => {
    const w1 = await chartW(page), r1 = await readout(page);
    const win1 = (await page.locator('.ov-win').boundingBox())!;
    await page.locator('.nav-in').click();
    await expect(page.locator('.nav-range')).toContainText('2×');
    // the readout changes at once; the width animates, so wait for it to settle
    await expect.poll(() => chartW(page)).toBeGreaterThan(w1 * 1.8);
    await expect.poll(async () => (await page.locator('.ov-win').boundingBox())!.width).toBeLessThan(win1.width * 0.6);
    const r2 = await readout(page);
    expect(r2.a).toBeGreaterThan(r1.a);
    expect(r2.b).toBeLessThan(r1.b);
    await page.locator('.nav-all').click();
    await expect(page.locator('.nav-range')).toContainText('· 1×');
  });

  test('jumping to an era fits it and makes the chart no taller', async ({ page }) => {
    const h1 = await chartH(page);
    await page.locator('#nav-era').selectOption({ label: 'Dry plate & snapshot (1880–1925)' });
    await expect.poll(async () => (await readout(page)).k).toBeGreaterThan(3);
    await page.waitForTimeout(700);
    const r = await readout(page);
    expect(r.a).toBeGreaterThanOrEqual(1860); expect(r.a).toBeLessThanOrEqual(1882);
    expect(r.b).toBeGreaterThanOrEqual(1923); expect(r.b).toBeLessThanOrEqual(1945);
    expect(await chartH(page)).toBeLessThan(h1);
    const inView = await page.evaluate(() => {
      const sc = document.querySelector('#scroller')!.getBoundingClientRect();
      const d = document.querySelector('#chart a.item[data-id="kodak-camera"] circle.dot')!.getBoundingClientRect();
      return d.left >= sc.left && d.right <= sc.right;
    });
    expect(inView).toBe(true);
  });

  test('brushing the overview zooms to that range; dragging the window pans', async ({ page }) => {
    const ov = (await page.locator('.ov').boundingBox())!;
    const y = ov.y + 30;
    await page.mouse.move(ov.x + ov.width * 0.6, y);
    await page.mouse.down();
    await page.mouse.move(ov.x + ov.width * 0.7, y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await readout(page)).k).toBeGreaterThan(4);
    await page.waitForTimeout(700);
    const sl = await page.locator('#scroller').evaluate((s) => s.scrollLeft);
    const win = (await page.locator('.ov-win').boundingBox())!;
    await page.mouse.move(win.x + win.width / 2, win.y + 20);
    await page.mouse.down();
    await page.mouse.move(win.x + win.width / 2 - 80, win.y + 20, { steps: 6 });
    await page.mouse.up();
    expect(await page.locator('#scroller').evaluate((s) => s.scrollLeft)).toBeLessThan(sl - 200);
  });

  test('keyboard: the window pans and the edges resize', async ({ page }) => {
    await page.locator('.nav-in').click();
    await page.waitForTimeout(700);
    const sl = await page.locator('#scroller').evaluate((s) => s.scrollLeft);
    await page.locator('.ov-win').focus();
    await page.keyboard.press('PageDown');
    await expect.poll(() => page.locator('#scroller').evaluate((s) => s.scrollLeft)).toBeGreaterThan(sl + 100);
    const before = await page.locator('.ov-h.l').getAttribute('aria-valuetext');
    await page.locator('.ov-h.l').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => page.locator('.ov-h.l').getAttribute('aria-valuetext')).not.toBe(before);
    await expect(page.locator('.ov-win')).toHaveAttribute('aria-valuetext', /^Showing .+ to .+$/);
  });

  test('ctrl + wheel over the chart zooms around the pointer', async ({ page }) => {
    const box = (await page.locator('#scroller').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.7, box.y + 200);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await expect.poll(async () => (await readout(page)).k).toBeGreaterThan(2);
  });

  test('the range survives opening an entry and going back', async ({ page }) => {
    await page.locator('#nav-era').selectOption({ label: 'Dry plate & snapshot (1880–1925)' });
    await page.waitForTimeout(900);
    const r = await readout(page);
    await page.locator('#chart a.item[data-id="kodak-camera"]').click();
    await expect(page).toHaveURL(/\/entries\/kodak-camera\/$/);
    await page.goBack();
    await expect(page.locator('.nav-range')).toContainText('×');
    await page.waitForTimeout(400);
    const back = await readout(page);
    expect(back.k).toBeCloseTo(r.k, 0);
    expect(Math.abs(back.a - r.a)).toBeLessThanOrEqual(3);
  });
});

test.describe('timeline zoom on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } });
  test('the navigator sticks to the screen and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/');
    await page.locator('#chart a.item[data-id="nikon-f"]').scrollIntoViewIfNeeded();
    const nav = (await page.locator('#nav').boundingBox())!;
    expect(nav.y + nav.height).toBeLessThanOrEqual(801);
    expect(nav.y).toBeGreaterThan(400);
    const sl = await page.locator('#scroller').evaluate((s) => s.scrollLeft);
    await page.locator('.ov-win').focus();
    await page.keyboard.press('End');
    await expect.poll(() => page.locator('#scroller').evaluate((s) => s.scrollLeft)).toBeGreaterThan(sl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('physics widgets', () => {
  const PRIMERS: [string, string, string][] = [
    // primer, a range input to move, the summary that should change
    ['pinhole', '#ph-d', '#ph-sum'],
    ['lenses', '#lf-f', '#lf-sum'],
    ['aperture', '#ap-n', '#ap-sum'],
    ['exposure', '#ex-n', '#ex-sum'],
    ['colour', '#col-k', '#col-wb-sum'],
    ['sensors', '#bay-p', '#bay-sum'],
    ['formats', '#fc-f', '#fc-sum'],
    ['computational', '#stk-n', '#stk-sum'],
  ];
  for (const [id, input, sum] of PRIMERS) {
    test(`${id}: the widget responds and has no axe violations`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/physics/${id}/`);
      const fig = page.locator('figure.wg');
      await expect(fig).toBeVisible();
      const before = await page.locator(sum).textContent();
      expect(before?.length).toBeGreaterThan(20);
      const range = page.locator(input);
      await range.focus();
      for (let i = 0; i < 4; i++) await range.press('ArrowRight');
      await expect(page.locator(sum)).not.toHaveText(before!);
      const { violations } = await new AxeBuilder({ page }).include('figure.wg').analyze();
      expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('exposure: sunny 16 is a correct exposure, and aperture priority keeps it correct', async ({ page }) => {
    await page.goto('/physics/exposure/');
    await expect(page.locator('#ex-verdict')).toHaveText('Correct');
    await page.locator('#ex-auto').check();
    const n = page.locator('#ex-n');
    await n.focus();
    for (let i = 0; i < 6; i++) await n.press('ArrowLeft');
    await expect(page.locator('#ex-verdict')).toHaveText('Correct');
    await expect(page.locator('#ex-t-out')).toHaveText('1/500 s');
  });

  test('silver: the exposure history lists every entry with an exposure', async ({ page }) => {
    await page.goto('/physics/silver/');
    await page.getByText('Show the data as a table').click();
    await expect(page.locator('.wg-table tbody tr')).toHaveCount(15);
    await expect(page.locator('.wg-table')).toContainText('Heliography');
  });

  test('primers link back to their entries', async ({ page }) => {
    await page.goto('/entries/bayer-filter/');
    await page.getByRole('link', { name: /Digital sensors/ }).first().click();
    await expect(page).toHaveURL(/\/physics\/sensors\/$/);
  });
});

test.describe('images and camera silhouettes', () => {
  test('landmarks show credited public-domain photographs', async ({ page }) => {
    await page.goto('/landmarks/');
    const figs = page.locator('.lm figure');
    expect(await figs.count()).toBeGreaterThanOrEqual(13);
    const first = page.locator('#boulevard-du-temple figure');
    await expect(first.locator('img')).toHaveAttribute('alt', /boulevard/i);
    await expect(first.locator('figcaption')).toContainText('Public domain');
    await expect(first.getByRole('link', { name: /source/ })).toHaveAttribute('href', /^https:\/\/commons\.wikimedia\.org\//);
    expect(await first.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  });

  test('an entry hero image fits the screen', async ({ page }) => {
    await page.goto('/entries/autochrome/');
    const img = page.locator('.hero img');
    await expect(img).toBeVisible();
    expect((await img.boundingBox())!.height).toBeLessThanOrEqual(560);
  });

  test('camera entries show their silhouette on the page and in the hover card', async ({ page }) => {
    await page.goto('/entries/rolleiflex/');
    await expect(page.locator('.camsil figcaption')).toHaveText('Twin-lens reflex (TLR)');
    await page.goto('/');
    await page.locator('a[href$="/entries/nikon-f/"]').first().focus();
    await expect(page.locator('.card .cam-thumb svg')).toBeVisible();
  });
});
