import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Clicks through every page and control. Any uncaught exception or console
// error fails the test, so it also catches crashes the other specs miss.
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}
const reviewRows = (page: Page) => page.locator('.review-row');
async function applyToVisible(page: Page, action: string) {
  await page.getByLabel('Select visible entries', { exact: true }).check();
  await page.getByLabel('Bulk action', { exact: true }).selectOption(action);
  await page.getByRole('button', { name: /^Apply to \d+ selected$/ }).click();
}

test('every page and control works without errors', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto('/');

  // Help dialog
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('How Counsel works.');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Time entries: sample data, range, week navigation, filters, export
  await page.getByRole('button', { name: /Load a sample workspace/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(9);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(9);
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByText('No entries match this view')).toBeVisible();
  await page.getByRole('button', { name: 'This week', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(9);
  await page
    .getByLabel('Filter by client')
    .selectOption({ label: 'Oak & Stone' });
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Filter by client').selectOption('all');
  await page.getByLabel('Filter by billability').selectOption('non-billable');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByLabel('Filter by billability').selectOption('all');
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/counsel-time.*\.csv$/);

  // Reports
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Time by client' }),
  ).toBeVisible();

  // Clients: add and rename
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.getByLabel('Client name').fill('Harbor Legal');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add client' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Harbor Legal', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit client Harbor Legal' }).click();
  await page.getByLabel('Client name').fill('Harbour Legal');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save changes' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Harbour Legal', exact: true }),
  ).toBeVisible();

  // Weekly review: navigation, search, filters, shortcut
  await page
    .getByRole('button', { name: 'Weekly review', exact: true })
    .click();
  await expect(reviewRows(page)).toHaveCount(9);
  await page.getByRole('button', { name: 'Previous review week' }).click();
  await expect(page.getByText('Nothing in this view.')).toBeVisible();
  await page.getByRole('button', { name: 'Next review week' }).click();
  await expect(reviewRows(page)).toHaveCount(9);
  await page.getByLabel('Search review', { exact: true }).fill('term sheet');
  await expect(reviewRows(page)).toHaveCount(1);
  await page.getByLabel('Search review', { exact: true }).fill('');
  await page
    .getByLabel('Review employee', { exact: true })
    .selectOption('Alex Morgan');
  await expect(reviewRows(page)).toHaveCount(9);
  await page.getByLabel('Review employee', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Show 9 needing review' }).click();
  await expect(page.getByLabel('Review status', { exact: true })).toHaveValue(
    'pending',
  );
  await page.getByLabel('Review status', { exact: true }).selectOption('all');

  // Every bulk action, each followed by its undo
  for (const [action, label] of [
    ['billable', 'Mark billable'],
    ['nonbillable', 'Mark non-billable'],
    ['review', 'Mark reviewed'],
  ]) {
    await applyToVisible(page, action);
    await expect(page.getByText(`${label}: 9 entries updated.`)).toBeVisible();
    await page
      .getByRole('button', { name: `Undo: ${label} (9 entries)` })
      .click();
    await expect(page.getByText(`Undone: ${label} (9 entries).`)).toBeVisible();
  }
  await applyToVisible(page, 'review');
  await expect(page.getByText('Reviewed in view').locator('..')).toContainText(
    '9 / 9',
  );
  await applyToVisible(page, 'reopen');
  await expect(page.getByText('Return to review: 9 entries')).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Select Weekly team planning' })
    .check();
  await page.getByLabel('Bulk action', { exact: true }).selectOption('client');
  await page
    .getByLabel('Destination client', { exact: true })
    .selectOption({ label: 'Oak & Stone' });
  await page.getByRole('button', { name: 'Apply to 1 selected' }).click();
  await expect(
    page.locator('.review-row', { hasText: 'Weekly team planning' }),
  ).toContainText('Oak & Stone');
  await page
    .getByRole('button', { name: 'Undo: Move to Oak & Stone (1 entry)' })
    .click();
  await expect(
    page.locator('.review-row', { hasText: 'Weekly team planning' }),
  ).toContainText('Firm · Internal');

  // Clear selection, per-row review toggle, edit dialog, export
  await page
    .getByRole('checkbox', { name: 'Select Practice development' })
    .check();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.selection-count')).toContainText('0 selected');
  await page
    .getByRole('button', { name: 'Review Weekly team planning' })
    .click();
  await page
    .getByRole('button', { name: 'Reopen Weekly team planning' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Review Weekly team planning' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit review entry: Practice development' })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Edit time entry');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const reviewCsv = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export view/ }).click();
  expect((await reviewCsv).suggestedFilename()).toMatch(
    /counsel-review-.*\.csv$/,
  );

  // Data: back up, restore that backup, then restore the pilot
  await page.getByRole('button', { name: 'Manage data', exact: true }).click();
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download a backup/ }).click();
  const backupFile = await (await backup).path();
  await page.getByLabel('Backup file').setInputFiles(backupFile!);
  await expect(page.getByText('Replace this workspace?')).toBeVisible();
  await expect(page.getByText('9 entries · 5 clients')).toBeVisible();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage data', exact: true }).click();
  await page.getByRole('button', { name: /Open pilot workspace/ }).click();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await page
    .getByRole('button', { name: 'Weekly review', exact: true })
    .click();
  await expect(reviewRows(page)).toHaveCount(18);

  // Logo returns to Time entries
  if (!isMobile) {
    await page.getByRole('link', { name: 'Counsel home' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  }

  expect(errors).toEqual([]);
});
