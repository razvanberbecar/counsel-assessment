import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// The pilot customer types dates as dd/mm/yyyy.
test.use({ locale: 'en-GB' });

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

// Types an ISO date digit by digit in the field order the browser displays
// (dd/mm/yyyy, mm/dd/yyyy, ...), as a person would.
async function typeDate(page: Page, box: Locator, iso: string) {
  const [year, month, day] = iso.split('-');
  const order = await page.evaluate(() =>
    new Intl.DateTimeFormat(navigator.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .formatToParts(new Date(2026, 9, 1))
      .filter((p) => p.type !== 'literal')
      .map((p) => p.type),
  );
  const parts: Record<string, string> = { day, month, year };
  await box.focus();
  await page.keyboard.type(order.map((t) => parts[t]).join(''));
}

async function openPilotReview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage data', exact: true }).click();
  await page.getByRole('button', { name: /Open pilot workspace/ }).click();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await page
    .getByRole('button', { name: 'Weekly review', exact: true })
    .click();
}

test('the review week can be typed with the keyboard', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Phones use the native date picker, not typing');
  await openPilotReview(page);
  const weekBox = page.getByLabel('Review week', { exact: true });
  await expect(weekBox).toHaveValue('2026-09-28');
  await page.getByRole('button', { name: 'Previous review week' }).click();
  await expect(weekBox).toHaveValue('2026-09-21');
  await expect(page.locator('.review-row')).toHaveCount(4);

  // Type Thursday 1 October 2026 digit by digit, as a person would.
  await typeDate(page, weekBox, '2026-10-01');
  await expect(weekBox).toHaveValue('2026-10-01');
  await expect(page.locator('.review-row')).toHaveCount(18);
  // Leaving the field shows the Monday that starts the chosen week.
  await weekBox.blur();
  await expect(weekBox).toHaveValue('2026-09-28');
  await expect(page.locator('.review-row')).toHaveCount(18);
});

test('time cannot be logged for a future date', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  await page.getByLabel('New client name').fill('Future Client');
  const dateBox = page.getByLabel('Date', { exact: true });
  await expect(dateBox).toHaveAttribute('max', fromToday(0));
  await dateBox.fill(fromToday(1));
  await page.getByLabel('Hours', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  // The browser blocks the out-of-range date and the dialog stays open.
  expect(
    await dateBox.evaluate(
      (el) => (el as HTMLInputElement).validity.rangeOverflow,
    ),
  ).toBe(true);
  await expect(page.getByRole('dialog')).toBeVisible();
  // Even without the browser hint, the app itself refuses the date.
  await dateBox.evaluate((el) => el.removeAttribute('max'));
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('future date');
  // Today is accepted.
  await dateBox.fill(fromToday(0));
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'Future Client' }).first(),
  ).toBeVisible();
});

test('one person cannot log more than 24 hours on one day', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  await page.getByLabel('New client name').fill('Long Day Client');
  await page.getByLabel('Hours', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  await page.getByLabel('Hours', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('more than 24 hours');
  await page.getByLabel('Hours', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the Log time date can be typed and bad durations are blocked', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Phones use the native date picker, not typing');
  await page.goto('/');
  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  await page.getByLabel('New client name').fill('Typed Date Client');
  const dateBox = page.getByLabel('Date', { exact: true });
  await typeDate(page, dateBox, '2026-10-01');
  await expect(dateBox).toHaveValue('2026-10-01');

  const hours = page.getByLabel('Hours', { exact: true });
  const minutes = page.getByLabel('Minutes', { exact: true });
  const save = page.getByRole('button', { name: 'Save entry', exact: true });
  const invalid = (box: typeof hours) =>
    box.evaluate((el) => !(el as HTMLInputElement).validity.valid);
  for (const [h, m] of [
    ['-1', '90'],
    ['1', '75'],
    ['1.5', '0'],
    ['25', '0'],
  ]) {
    await hours.fill(h);
    await minutes.fill(m);
    await save.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await invalid(hours)) || (await invalid(minutes))).toBe(true);
  }
  await hours.fill('1');
  await minutes.fill('30');
  await save.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Typed Date Client/ }).first(),
  ).toBeVisible();
});
