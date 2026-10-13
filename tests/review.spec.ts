import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openPilotReview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage data', exact: true }).click();
  await page.getByRole('button', { name: /Open pilot workspace/ }).click();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await page
    .getByRole('button', { name: 'Weekly review', exact: true })
    .click();
  await expect(page.getByLabel('Review week', { exact: true })).toHaveValue(
    '2026-09-28',
  );
}
const row = (page: Page, id: string) =>
  page.locator(`.review-row[data-entry-id="${id}"]`);

test('editing only the description keeps a non-billable entry non-billable', async ({
  page,
}) => {
  await openPilotReview(page);
  await page
    .getByRole('button', { name: 'Edit review entry: Weekly team planning' })
    .click();
  await page
    .getByLabel('Description')
    .fill('Weekly team planning and staffing');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(row(page, 'entry-002')).toContainText('Non-billable');
  await expect(row(page, 'entry-002')).toContainText(
    'Weekly team planning and staffing',
  );
});

test('totals and export follow the filters, not the selection', async ({
  page,
}) => {
  await openPilotReview(page);
  await page
    .getByLabel('Review client', { exact: true })
    .selectOption('meridian');
  await expect(page.locator('.review-row')).toHaveCount(5);
  await expect(page.getByTestId('review-total')).toHaveText('6h 30m');
  await page
    .getByLabel('Review status', { exact: true })
    .selectOption('reviewed');
  await expect(page.locator('.review-row')).toHaveCount(2);
  await page
    .getByRole('checkbox', { name: 'Select Shareholder agreement review' })
    .check();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export view/ }).click();
  const file = readFileSync((await (await downloading).path())!, 'utf8');
  const lines = file.trim().split('\r\n');
  expect(lines).toHaveLength(3);
  expect(file).toContain('Shareholder agreement review');
  expect(file).toContain('Transaction due diligence');
  expect(file).not.toContain('Closing checklist');
});

test('selection scope, correction resets review, and undo is scoped', async ({
  page,
}) => {
  await openPilotReview(page);
  await page.getByLabel('Select visible entries', { exact: true }).check();
  await expect(page.locator('.selection-count')).toContainText('18 selected');
  await page
    .getByLabel('Review client', { exact: true })
    .selectOption('meridian');
  await expect(page.locator('.selection-count')).toContainText('0 selected');
  await expect(
    page.getByText(/Selection cleared because the view changed/),
  ).toBeVisible();

  await page
    .getByRole('checkbox', { name: 'Select Shareholder agreement review' })
    .check();
  await page.getByLabel('Bulk action', { exact: true }).selectOption('client');
  await page
    .getByLabel('Destination client', { exact: true })
    .selectOption('oak');
  await expect(page.getByTestId('action-scope')).toContainText(
    '“Move to Oak & Stone” will change 1 entry (1h 30m) from Meridian Holdings.',
  );
  await page.getByRole('button', { name: 'Apply to 1 selected' }).click();
  await expect(page.getByText(/left this view/)).toBeVisible();
  await page.getByLabel('Review client', { exact: true }).selectOption('oak');
  await expect(row(page, 'entry-001')).toContainText('Needs review');

  // Independent edit after the review action, then try to undo the move
  await page
    .getByRole('button', {
      name: 'Edit review entry: Shareholder agreement review',
    })
    .click();
  await page.getByLabel('Hours', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: /Undo: Move to Oak & Stone/ }).click();
  await expect(page.getByRole('alert')).toContainText('Undo cancelled');
  await expect(row(page, 'entry-001')).toContainText('2h 30m');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
