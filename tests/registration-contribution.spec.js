const { test, expect } = require('playwright/test');
const { createPreviewServer, event } = require('./helpers/contribution-preview.cjs');
let server, base;
test.beforeAll(async () => {
  server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
async function register(page) {
  await page.goto(`${base}/register/preview`);
  await page.locator('[name="name"]').fill('Preview attendee');
  await page.locator('[name="email"]').fill('preview@example.test');
  await page.locator('[name="phone"]').fill('9000000000');
  await page.locator('[name="age"]').fill('25');
  await page.locator('[name="gender"]').selectOption('Female');
  await page.locator('[name="profile"]').selectOption('Student');
  await page.locator('[name="attendedBefore"][value="No"]').check();
  await page.locator('[name="source"]').selectOption('Friend');
  await page.getByRole('button', { name: 'Reserve My Spot' }).click();
}
for (const width of [390, 1440]) test(`registration offers a skippable contribution at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await register(page);
  await expect(page.locator('.contribution-panel')).toBeVisible();
  await expect(page.locator('.contribution-confirmed')).toHaveText('Your registration is confirmed');
  await expect(page.locator('.contribution-optional')).toContainText('Your spot is reserved');
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  await expect(page.locator('.contribution-payment .donation-recipient')).toHaveCount(0);
  await expect(page.locator('#suhbahContributionQr')).toHaveAttribute('src', '/assets/suhbah-contribution-qr.png');
  await expect(page.locator('#suhbahContributionQr')).toBeHidden();
  expect((await page.locator('.contribution-panel').boundingBox()).height).toBeLessThan(760);
  await page.getByText('Scan QR code', { exact: true }).click();
  await expect(page.locator('#suhbahContributionQr')).toBeVisible();
  await page.getByText('Scan QR code', { exact: true }).click();
  await expect(page.locator('.donation-banner')).toHaveCount(0);
  expect(page.url()).toContain('/register/preview');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.locator('.success-panel')).toContainText('Your spot is reserved');
  await expect(page.getByRole('link', { name: "Join this month's Suhbah WhatsApp group" })).toHaveAttribute('href', event.communityGroupLink);
  await expect(page.getByRole('link', { name: 'Add to Google Calendar' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('waitlist stays a waitlist after skipping', async ({ page }) => {
  await page.route('**/api/registrations', route => route.fulfill({ json: { registration: { eventId: event.id, eventNumber: event.number, eventTheme: event.theme, registrationStatus: 'Waitlist' } } }));
  await register(page);
  await expect(page.locator('.contribution-optional')).toContainText('Skipping keeps your place on the waitlist');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.locator('.success-panel')).toContainText("You're on the waitlist");
  await expect(page.locator('.success-panel')).not.toContainText('Your spot is reserved');
});
test('failed registrations do not reach the contribution step', async ({ page }) => {
  await page.route('**/api/registrations', route => route.fulfill({ status: 409, json: { error: 'You are already registered.' } }));
  await register(page);
  await expect(page.getByRole('alert')).toHaveText('You are already registered.');
  await expect(page.locator('.contribution-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reserve My Spot' })).toBeEnabled();
});
for (const mobile of [false, true]) test(`configured payments use Suhbah details, mobile=${mobile}`, async ({ browser }) => {
  const context = await browser.newContext(mobile ? { userAgent: 'Android', viewport: { width: 390, height: 844 } } : {});
  const page = await context.newPage();
  await register(page);
  await expect(page.locator('.contribution-payment .donation-recipient')).toHaveCount(0);
  await expect(page.locator('.contribution-panel')).not.toContainText('THEHUBFOUNDATION');
  const google = page.locator('.contribution-panel [aria-label="Donate via Google Pay"]');
  if (mobile) {
    await expect(google).toHaveAttribute('href', /pa=farhathcr7%40oksbi/);
    await expect(google).toHaveAttribute('href', /package=com.google.android.apps.nbu.paisa.user/);
  } else {
    await expect(google).toHaveAttribute('href', '#suhbahContributionQr');
    await google.click();
    await expect(page.locator('#suhbahContributionQr')).toBeVisible();
    expect(page.url()).not.toContain('#suhbahContributionQr');
  }
  await page.getByRole('button', { name: 'Continue after payment' }).click();
  await expect(page.locator('.success-panel')).toBeVisible();
  await context.close();
});
