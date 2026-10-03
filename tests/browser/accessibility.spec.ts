import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('core pages meet automated WCAG AA accessibility checks', async ({ page }) => {
  for (const route of ['/', '/browse/', '/produce/avocado/', '/favorites/', '/about/']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.length,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        null,
        2,
      ),
    ).toBe(0);
  }
});
