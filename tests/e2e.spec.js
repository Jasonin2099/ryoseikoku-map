const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const shotDir = path.join(__dirname, '..', 'test-results', 'screenshots');

test.beforeAll(async () => {
  fs.mkdirSync(shotDir, { recursive: true });
});

test('home loads and map is visible', async ({ page }, testInfo) => {
  const res = await page.goto('/');
  expect(res.status()).toBe(200);
  await expect(page.locator('#mapSvg path.region')).toHaveCount(70);
  await expect(page.locator('h1.title')).toHaveText('令制国');
  await page.screenshot({
    path: path.join(shotDir, `${testInfo.project.name}-home.png`),
    fullPage: true,
  });
});

test('hash opens yamashiro with grade and kokufu', async ({ page }, testInfo) => {
  await page.goto('/#yamashiro');
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator('#pc-yamashiro .pc-kanji')).toContainText('山城');
  await expect(page.locator('#pc-yamashiro')).toContainText('上国');
  await expect(page.locator('#pc-yamashiro')).toContainText('畿内');
  await expect(page.locator('#pc-yamashiro')).toContainText('乙訓郡');
  await expect(page.locator('#pc-yamashiro')).toContainText('賀茂別雷神社');
  await expect(page.locator('#pc-yamashiro')).toContainText('諸説');
  await page.screenshot({
    path: path.join(shotDir, `${testInfo.project.name}-yamashiro.png`),
  });
});

test('search finds a province and opens it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('やましろ');
  await expect(page.locator('#searchResults button[data-id="yamashiro"]')).toBeVisible();
  await page.locator('#searchResults button[data-id="yamashiro"]').click();
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator('#pc-yamashiro .pc-kanji')).toContainText('山城');
});

test('search finds a kuni by ichinomiya shrine name', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('鹿島');
  await expect(page.locator('#searchResults button[data-id="hitachi"]')).toBeVisible();
  await page.locator('#searchResults button[data-id="hitachi"]').click();
  await expect(page.locator('#pc-hitachi')).toContainText('鹿島神宮');
});

test('search finds provinces by dao name, including simplified characters', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('山陽道');
  await expect(page.locator('#searchResults button[data-id="harima"]')).toBeVisible();
  await expect(page.locator('#searchResults button[data-id="aki"]')).toBeVisible();
  await page.locator('#searchInput').fill('');
  await page.locator('#searchInput').fill('山阳道');
  await expect(page.locator('#searchResults button[data-id="harima"]')).toBeVisible();
  await expect(page.locator('#searchResults button[data-id="nagato"]')).toBeVisible();
});

test('search finds Hokkaido and opens the outside drawer', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('蝦夷地');
  await expect(page.locator('#searchResults button[data-id="hokkaido"]')).toBeVisible();
  await page.locator('#searchResults button[data-id="hokkaido"]').click();
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator('#drawerBody')).toContainText('蝦夷地');
});

test('search keyboard moves the highlight and Enter opens it', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('#searchInput');
  await input.fill('やましろ');
  await expect(page.locator('#searchResults button[data-id="yamashiro"]')).toBeVisible();
  await input.press('ArrowDown');
  await expect(page.locator('#searchResults button[data-id="yamashiro"]')).toHaveClass(/is-active/);
  await input.press('Enter');
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator('#pc-yamashiro .pc-kanji')).toContainText('山城');
});

test('dao filter dims other regions', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dao-chip[data-dao="kinai"]').click();
  await expect(page.locator('#mapWrap')).toHaveClass(/filtering/);
  const matched = await page.locator('#mapSvg path.region.is-match').count();
  expect(matched).toBe(5);
});

test('language toggle switches lede to Chinese', async ({ page }) => {
  await page.goto('/');
  await page.locator('#langToggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#lede')).toContainText('陆奥');
});

test('color-scheme light still renders the map', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const res = await page.goto('/');
  expect(res.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#mapSvg path.region')).toHaveCount(70);
  await page.screenshot({
    path: path.join(shotDir, `${testInfo.project.name}-light.png`),
    fullPage: true,
  });
});

test('theme toggle switches and persists', async ({ page }) => {
  await page.goto('/');
  const initial = await page.locator('html').getAttribute('data-theme');
  expect(initial === 'light' || initial === 'dark').toBeTruthy();
  await page.locator('#themeToggle').click();
  const next = initial === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
});

test('color-scheme dark still renders the map', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const res = await page.goto('/');
  expect(res.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#mapSvg path.region')).toHaveCount(70);
  await page.screenshot({
    path: path.join(shotDir, `${testInfo.project.name}-dark.png`),
    fullPage: true,
  });
});

function zoomShotDir() {
  const preferred = '/workspace/kuni-shots';
  const fallback = path.join(__dirname, '..', 'test-results', 'zoom-shots');
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch (e) {
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#mapSvg path.region')).toHaveCount(70);
  await expect(page.locator('#mapSvg path.kuni-hit')).toHaveCount(68);
}

async function forceLight(page) {
  await page.addInitScript(() => {
    localStorage.setItem('kuni-theme', 'light');
    localStorage.setItem('kuni-lang', 'ja');
  });
  await page.emulateMedia({ colorScheme: 'light' });
}

async function forceDark(page) {
  await page.addInitScript(() => {
    localStorage.setItem('kuni-theme', 'dark');
    localStorage.setItem('kuni-lang', 'ja');
  });
  await page.emulateMedia({ colorScheme: 'dark' });
}

async function tapUntilSelected(page, id, maxTaps = 3) {
  for (let i = 0; i < maxTaps; i++) {
    await page.evaluate((pid) => window.__kuniTest.tap('kuni', pid), id);
    await page.waitForTimeout(450);
    const open = await page.locator('#drawer').evaluate((el) => el.classList.contains('open'));
    if (open) {
      const sel = await page.evaluate(() => window.__kuniTest.selected());
      expect(sel.id).toBe(id);
      return i + 1;
    }
  }
  throw new Error('failed to select ' + id);
}

test('kuni hit targets cover 68 provinces', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#kuni-yamashiro')).toHaveCount(1);
  await expect(page.locator('#kuni-iki')).toHaveCount(1);
  await expect(page.locator('#kuni-tsushima')).toHaveCount(1);
  await expect(page.locator('#kuni-oki')).toHaveCount(1);
});

test('lang query and default Japanese', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.goto('/?lang=zh');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#lede')).toContainText('陆奥');
  await page.locator('#langToggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});

const SMALL = [
  ['yamashiro','山城'], ['yamato','大和'], ['settsu','摂津'], ['izumi','和泉'], ['kawachi','河内'],
  ['iki','壱岐'], ['tsushima','対馬'], ['oki','隠岐'], ['awaji','淡路'], ['sado','佐渡'],
  ['shima','志摩'], ['iga','伊賀'], ['wakasa','若狭'], ['tango','丹後'], ['awa-boso','安房'],
  ['owari','尾張'], ['kai','甲斐'], ['omi','近江'], ['sanuki','讃岐'], ['chikugo','筑後'],
];

test('size-based taps select listed small provinces', async ({ page }) => {
  test.setTimeout(180000);
  await ready(page);
  for (const [id, ja] of SMALL) {
    await page.goto('/');
    await expect(page.locator('#mapSvg path.kuni-hit')).toHaveCount(68);
    const taps = await tapUntilSelected(page, id, 3);
    expect(taps, id).toBeLessThanOrEqual(3);
    /* 山城・大和・摂津 are large enough after a 畿内 zoom. 河内・和泉 can
       stay under 44px with real borders, so a third (neighbour) step is allowed. */
    if (['yamashiro','yamato','settsu'].includes(id)) {
      expect(taps, id + ' should be selectable in two taps').toBeLessThanOrEqual(2);
    }
    await expect(page.locator('#pc-' + id + ' .pc-kanji')).toContainText(ja);
  }
});

test('back chain closes drawer, then dao, then nationwide, then leaves', async ({ page }) => {
  await ready(page);
  await tapUntilSelected(page, 'yamashiro', 3);
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  const nav1 = await page.evaluate(() => window.__kuniTest.nav());
  expect(nav1[nav1.length - 1]).toBe('detail');
  expect(nav1.length).toBeGreaterThanOrEqual(4); // full + dao + kuni + detail

  const fullVB = '0 0 1100 909';

  await page.goBack();
  await page.waitForTimeout(400);
  await expect(page.locator('#drawer')).not.toHaveClass(/open/);
  const nav2 = await page.evaluate(() => window.__kuniTest.nav());
  expect(nav2[nav2.length - 1]).not.toBe('detail');
  const vb2 = await page.evaluate(() => window.__kuniTest.viewBox());
  expect(vb2).not.toBe(fullVB);

  await page.goBack();
  await page.waitForTimeout(400);
  const nav3 = await page.evaluate(() => window.__kuniTest.nav());
  /* should be at dao (or still not full if extra level) */
  const vb3 = await page.evaluate(() => window.__kuniTest.viewBox());
  if (nav3[nav3.length - 1] !== 'full') {
    expect(vb3).not.toBe(fullVB);
    await page.goBack();
    await page.waitForTimeout(400);
  }
  const nav4 = await page.evaluate(() => window.__kuniTest.nav());
  expect(nav4).toEqual(['full']);
  const vb4 = await page.evaluate(() => window.__kuniTest.viewBox());
  expect(vb4).toBe(fullVB);
  await expect(page.locator('#crumb')).toBeHidden();

  /* fourth back must not cycle back into a zoomed/selected state */
  const urlBefore = page.url();
  await page.goBack();
  await page.waitForTimeout(300);
  const nav5 = await page.evaluate(() => window.__kuniTest && window.__kuniTest.nav && window.__kuniTest.nav()).catch(() => null);
  if (nav5) {
    expect(nav5[nav5.length - 1] === 'full' || nav5[nav5.length - 1] === undefined).toBeTruthy();
    const selected = await page.evaluate(() => window.__kuniTest.selected());
    expect(selected.id).toBeFalsy();
  }
});

test('Esc goes back one level at a time', async ({ page }) => {
  await ready(page);
  await tapUntilSelected(page, 'yamato', 3);
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  await expect(page.locator('#drawer')).not.toHaveClass(/open/);
  const z = await page.evaluate(() => window.__kuniTest.zoom());
  expect(z).toBeGreaterThan(1.05);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const vb = await page.evaluate(() => window.__kuniTest.viewBox());
  expect(vb).toBe('0 0 1100 909');
});

test('dao chip zooms to the dao and すべて returns to full view', async ({ page }) => {
  await ready(page);
  const before = await page.evaluate(() => window.__kuniTest.viewBox());
  await page.locator('.dao-chip[data-dao="sanyodo"]').click();
  await page.waitForTimeout(400);
  const mid = await page.evaluate(() => window.__kuniTest.viewBox());
  expect(mid).not.toBe(before);
  await expect(page.locator('#crumb')).toBeVisible();
  await expect(page.locator('#crumb')).toContainText('全国');
  await expect(page.locator('#crumb')).toContainText('山陽道');
  await page.locator('.dao-chip[data-dao="all"]').click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__kuniTest.viewBox());
  expect(after).toBe('0 0 1100 909');
});

test('search selection zooms and opens the drawer', async ({ page }) => {
  await ready(page);
  await page.locator('#searchInput').fill('安芸');
  await expect(page.locator('#searchResults button[data-id="aki"]')).toBeVisible();
  await page.locator('#searchResults button[data-id="aki"]').click();
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator('#pc-aki .pc-kanji')).toContainText('安芸');
  await page.waitForTimeout(500);
  const z = await page.evaluate(() => window.__kuniTest.zoom());
  expect(z).toBeGreaterThan(1.2);
});

test('breadcrumb 全国 returns to full view', async ({ page }) => {
  await ready(page);
  await page.locator('.dao-chip[data-dao="kinai"]').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#crumb.is-on')).toBeVisible();
  await page.locator('#crumb [data-crumb="full"]').click();
  await page.waitForTimeout(400);
  const vb = await page.evaluate(() => window.__kuniTest.viewBox());
  expect(vb).toBe('0 0 1100 909');
});

test('sea tap deselects without unzooming', async ({ page }) => {
  await ready(page);
  await tapUntilSelected(page, 'aki', 3);
  const z1 = await page.evaluate(() => window.__kuniTest.zoom());
  await page.locator('#mapSea').dispatchEvent('click');
  await page.waitForTimeout(350);
  await expect(page.locator('#drawer')).not.toHaveClass(/open/);
  const z2 = await page.evaluate(() => window.__kuniTest.zoom());
  expect(Math.abs(z2 - z1)).toBeLessThan(0.2);
});

test('labels appear when a country is wide enough', async ({ page }) => {
  await ready(page);
  await page.locator('.dao-chip[data-dao="kinai"]').click();
  await page.waitForTimeout(400);
  await expect(page.locator('.kuni-label')).toHaveCount(await page.locator('.kuni-label').count());
  const n = await page.locator('.kuni-label').count();
  expect(n).toBeGreaterThan(0);
  await expect(page.locator('.kuni-label', { hasText: '山城' })).toBeVisible();
});


test('search empty state and Escape clears the query', async ({ page }) => {
  await ready(page);
  await page.locator('#searchInput').fill('存在しない国名xyz');
  await expect(page.locator('#searchResults')).toBeVisible();
  await expect(page.locator('#searchResults .search-empty')).toBeVisible();
  await page.locator('#searchInput').press('Escape');
  await expect(page.locator('#searchResults')).toBeHidden();
  await expect(page.locator('#searchInput')).toHaveValue('');
});

test('zoom constants and size thresholds match the spec', async ({ page }) => {
  await ready(page);
  const c = await page.evaluate(() => window.__kuniTest.constants());
  expect(c.TAP_MIN).toBe(44);
  expect(c.LABEL_MIN).toBe(56);
  expect(c.ZOOM_MAX).toBe(24);
  const mutsu = await page.evaluate(() => window.__kuniTest.screenShort('kuni', 'mutsu'));
  const yamashiro = await page.evaluate(() => window.__kuniTest.screenShort('kuni', 'yamashiro'));
  /* 畿内の小国は全国視点で 44px 未満。陸奥はそれより大きいが、
     狭いモバイル幅では 44px に届かないことがある。 */
  expect(yamashiro).toBeLessThan(c.TAP_MIN);
  expect(mutsu).toBeGreaterThan(yamashiro);
  const width = page.viewportSize() ? page.viewportSize().width : 0;
  if (width >= 1000) expect(mutsu).toBeGreaterThan(c.TAP_MIN);
  await page.locator('.dao-chip[data-dao="kinai"]').click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__kuniTest.screenShort('kuni', 'yamashiro'));
  expect(after).toBeGreaterThan(yamashiro);
  const zoom = await page.evaluate(() => window.__kuniTest.zoom());
  expect(zoom).toBeGreaterThan(1);
  expect(zoom).toBeLessThanOrEqual(c.ZOOM_MAX);
});

test('screenshots: light full, kinai two-step, sanyodo, labels, dark', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const SHOTS = zoomShotDir();
  const vp = testInfo.project.name === 'mobile' ? 'mobile-390x844' : 'desktop-1280x800';
  if (testInfo.project.name !== 'mobile') {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  await forceLight(page);
  await ready(page);
  await page.screenshot({ path: `${SHOTS}/zoom-${vp}-light-full.png`, fullPage: true });

  /* two-step 畿内: first tap zooms to dao */
  await page.evaluate(() => window.__kuniTest.tap('kuni', 'yamashiro'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/zoom-${vp}-light-kinai-step1.png`, fullPage: false });
  await page.evaluate(() => window.__kuniTest.tap('kuni', 'yamashiro'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/zoom-${vp}-light-kinai-selected.png`, fullPage: false });

  await page.goto('/');
  await expect(page.locator('#mapSvg path.kuni-hit')).toHaveCount(68);
  await page.locator('.dao-chip[data-dao="sanyodo"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/zoom-${vp}-light-sanyodo.png`, fullPage: false });

  /* labels + breadcrumb close-up of the map */
  await page.locator('#mapWrap').screenshot({ path: `${SHOTS}/zoom-${vp}-light-labels.png` });

  /* dark mode one shot */
  await forceDark(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#mapSvg path.kuni-hit')).toHaveCount(68);
  await page.evaluate(() => window.__kuniTest.select('kuni', 'aki'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/zoom-${vp}-dark-aki.png`, fullPage: false });
});


test('播磨 uses 山陽道 colour, not 畿内', async ({ page }) => {
  await ready(page);
  const colors = await page.evaluate(() => {
    const cs = (id) => {
      const el = document.querySelector('path.region[data-id="' + id + '"]');
      return el ? getComputedStyle(el).fill : null;
    };
    return { harima: cs('harima'), aki: cs('aki'), yamashiro: cs('yamashiro') };
  });
  expect(colors.harima).toBeTruthy();
  expect(colors.harima).toBe(colors.aki);
  expect(colors.harima).not.toBe(colors.yamashiro);
});

async function gapAboveDrawer(page) {
  return page.evaluate(() => {
    const svg = document.getElementById('mapSvg');
    const drawer = document.getElementById('drawer');
    if (!svg || !drawer) return 999;
    const a = svg.getBoundingClientRect();
    const b = drawer.getBoundingClientRect();
    return b.top - a.bottom;
  });
}

test('mobile half-drawer leaves no gap under the map', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout only');
  test.setTimeout(90000);
  const SHOTS = zoomShotDir();
  await forceLight(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);

  async function selectAndCheck(id, shot) {
    await page.goto('/');
    await expect(page.locator('#mapSvg path.kuni-hit')).toHaveCount(68);
    await page.evaluate((pid) => window.__kuniTest.select('kuni', pid), id);
    await page.waitForTimeout(800);
    await expect(page.locator('#drawer')).toHaveClass(/open/);
    const gap = await gapAboveDrawer(page);
    expect(gap, id + ' gap').toBeLessThan(8);
    /* A few pixels under the drawer's rounded top edge is fine. */
    expect(gap, id + ' overlap').toBeGreaterThan(-8);
    await page.screenshot({ path: `${SHOTS}/v2-mobile-390x844-${shot}.png`, fullPage: false });
  }

  await selectAndCheck('yamashiro', 'yamashiro');
  await selectAndCheck('iki', 'iki');
  await selectAndCheck('aki', 'aki');
});

test('v2 screenshots: desktop full, sanyodo 播磨, mobile 山城, dark', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const SHOTS = zoomShotDir();
  if (testInfo.project.name === 'mobile') {
    await forceLight(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(() => window.__kuniTest.select('kuni', 'yamashiro'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/v2-mobile-yamashiro-selected.png`, fullPage: false });
    return;
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await forceLight(page);
  await ready(page);
  await page.screenshot({ path: `${SHOTS}/v2-desktop-light-full.png`, fullPage: true });

  await page.locator('.dao-chip[data-dao="sanyodo"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/v2-desktop-sanyodo-harima.png`, fullPage: false });

  await forceDark(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#mapSvg path.region')).toHaveCount(70);
  await page.evaluate(() => window.__kuniTest.select('kuni', 'aki'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/v2-desktop-dark-aki.png`, fullPage: false });
});

test('reduced-motion jumps without hanging', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.evaluate(() => window.__kuniTest.tap('kuni', 'yamashiro'));
  await page.waitForTimeout(50);
  await page.waitForTimeout(500);
  const z = await page.evaluate(() => window.__kuniTest.zoom());
  expect(z).toBeGreaterThan(1.2);
});
