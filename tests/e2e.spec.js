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
  await expect(page.locator('#mapSvg path.region')).toHaveCount(47);
  await expect(page.locator('h1.title')).toHaveText('令制国');
  await page.screenshot({
    path: path.join(shotDir, `${testInfo.project.name}-home.png`),
    fullPage: true,
  });
});

test('hash opens yamashiro with grade and kokufu', async ({ page }, testInfo) => {
  await page.goto('/#yamashiro');
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator('#pc-yamashiro .pc-kanji')).toHaveText('山城');
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
  await expect(page.locator('#pc-yamashiro .pc-kanji')).toHaveText('山城');
});

test('search finds a kuni by ichinomiya shrine name', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('鹿島');
  await expect(page.locator('#searchResults button[data-id="hitachi"]')).toBeVisible();
  await page.locator('#searchResults button[data-id="hitachi"]').click();
  await expect(page.locator('#pc-hitachi')).toContainText('鹿島神宮');
});

test('dao filter dims other regions', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dao-chip[data-dao="kinai"]').click();
  await expect(page.locator('#mapWrap')).toHaveClass(/filtering/);
  const matched = await page.locator('#mapSvg path.region.is-match').count();
  expect(matched).toBeGreaterThan(0);
  expect(matched).toBeLessThan(47);
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
  await expect(page.locator('#mapSvg path.region')).toHaveCount(47);
  await page.screenshot({
    path: path.join(shotDir, `${testInfo.project.name}-light.png`),
    fullPage: true,
  });
});
