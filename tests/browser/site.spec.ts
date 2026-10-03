import { test, expect } from '@playwright/test';
test('search supports aliases, whitespace, filters, and recovery', async ({ page }) => {
  await page.goto('/browse/?q=%20AuBeRgInE%20');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
  await expect(page.locator('[data-card]:visible')).toHaveAttribute('data-card', 'eggplant');
  await page.getByRole('searchbox', { name: 'Search produce', exact: true }).fill('  COURGETTE  ');
  await expect(page.locator('[data-card]:visible')).toHaveAttribute('data-card', 'zucchini');
  await page
    .getByRole('searchbox', { name: 'Search produce', exact: true })
    .fill('nothing-like-this');
  await expect(page.getByRole('heading', { name: 'No produce found' })).toBeVisible();
  await page.getByRole('link', { name: 'See all produce', exact: true }).click();
  await page.getByRole('button', { name: 'Vegetables', exact: true }).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(5);
});
test('condition advice changes while nutrition stays tied to its original form', async ({
  page,
}) => {
  await page.goto('/produce/avocado/');
  await expect(page.locator('[data-panel="ripe"]')).toBeVisible();
  const nutrition = await page.locator('#nutrition').innerText();
  await page.getByRole('button', { name: 'Unripe', exact: true }).click();
  await expect(page.locator('[data-panel="unripe"]')).toBeVisible();
  await expect(page.locator('[data-panel="ripe"]')).toBeHidden();
  await expect(page.locator('[data-panel="unripe"]')).toContainText('Room temperature');
  await expect(page.locator('.storage-lead')).toContainText('room temperature');
  await expect(page.locator('[data-storage-label]')).toHaveText('unripe');
  expect(await page.locator('#nutrition').innerText()).toBe(nutrition);
  await page.getByRole('button', { name: 'Cut', exact: true }).click();
  await expect(page.locator('[data-panel="cut"]')).toContainText('Refrigerator');
});
test('favorites persist, download, work offline, and remove the cached guide', async ({
  page,
  context,
}) => {
  await page.goto('/produce/avocado/');
  await page.getByRole('button', { name: 'Save Avocados', exact: true }).click();
  await expect(page.locator('[data-offline-status="avocado"]')).toContainText('Ready offline', {
    timeout: 30000,
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove Avocados', exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.goto('/favorites/');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
  await page.getByRole('link', { name: 'Avocados', exact: true }).click();
  await expect(page.locator('#nutrition')).toContainText('206');
  await expect(page.locator('.detail-photo img')).toBeVisible();
  expect(
    await page
      .locator('.detail-photo img')
      .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
  ).toBe(true);
  await page.getByRole('button', { name: 'Unripe', exact: true }).click();
  await expect(page.locator('[data-panel="unripe"]')).toBeVisible();
  await page.goto('/produce/banana/');
  await expect(
    page.getByRole('heading', { name: 'A little connection is missing.' }),
  ).toBeVisible();
  await page.goto('/favorites/');
  await page.getByRole('button', { name: 'Remove Avocados', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good things are worth keeping.' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await caches.keys()).filter((k) => k.startsWith('producewise-guide-avocado-')).length,
      ),
    )
    .toBe(0);
});
test('unavailable local storage produces an honest error and leaves controls usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  await page.goto('/produce/banana/');
  await page.getByRole('button', { name: 'Save Bananas', exact: true }).click();
  await expect(page.locator('[data-toast]')).toContainText('couldn’t save');
  await expect(page.getByRole('button', { name: 'Save Bananas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Ripe', exact: true }).click();
  await expect(page.locator('[data-panel="ripe"]')).toBeVisible();
});
test('pages have no horizontal overflow and locally hosted photos load', async ({
  page,
}, testInfo) => {
  for (const path of ['/', '/browse/', '/produce/avocado/', '/about/']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path,
    ).toBe(true);
    await page
      .locator('img')
      .evaluateAll((imgs) => imgs.forEach((img) => ((img as HTMLImageElement).loading = 'eager')));
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll((imgs) =>
            imgs.every(
              (img) =>
                (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    if (testInfo.project.name === 'desktop') {
      await page.setViewportSize({ width: 768, height: 1024 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `Tablet: ${path}`,
      ).toBe(true);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    if (process.env.CAPTURE_REVIEW && (path === '/' || path === '/produce/avocado/')) {
      const name = path === '/' ? 'home' : 'avocado';
      await page.screenshot({
        path: `docs/screenshots/${name}-${testInfo.project.name}.png`,
        fullPage: false,
      });
    }
  }
});
test('404 and favorites empty states are useful', async ({ page }) => {
  await page.goto('/missing-produce/');
  await expect(page.getByRole('heading', { name: 'That one’s not in our basket.' })).toBeVisible();
  await page.goto('/favorites/');
  await expect(page.getByRole('heading', { name: 'Good things are worth keeping.' })).toBeVisible();
});
test('keyboard search and focus work', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('link', { name: 'Skip to content' }).press('Enter');
  await page.getByLabel('What produce are you looking for?').fill('banana');
  await page.getByLabel('What produce are you looking for?').press('Enter');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
  await expect(page.locator('[data-card]:visible')).toHaveAttribute('data-card', 'banana');
});
