import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => [n.target, n.any[0]?.message]),
  }));
}

test('dark theme toggles, persists and keeps WCAG contrast', async ({
  page,
}) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Dark theme' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /Load a sample workspace/ }).click();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await axeViolations(page)).toEqual([]);

  await page
    .getByRole('button', { name: 'Weekly review', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'Select Weekly team planning' })
    .check();
  expect(await axeViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  expect(await axeViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');

  // The choice survives a reload, and the toggle switches back.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
