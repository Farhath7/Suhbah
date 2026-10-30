const { test, expect } = require('playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

test('public navigation hides admin and dashboard access requires an admin session', async ({ page, request, browserName }) => {
  const root = path.resolve(__dirname, '..');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-admin-test-'));
  let server;
  try {
    for (const file of ['server.js', 'storage.js', 'registration-email.js', 'index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']) {
      fs.copyFileSync(path.join(root, file), path.join(temporaryRoot, file));
    }
    fs.mkdirSync(path.join(temporaryRoot, 'data'));
    fs.mkdirSync(path.join(temporaryRoot, 'assets'));
    fs.copyFileSync(path.join(root, 'assets', 'suhbah-logo.png'), path.join(temporaryRoot, 'assets', 'suhbah-logo.png'));
    fs.copyFileSync(path.join(root, 'assets', 'suhbah-logo-display.webp'), path.join(temporaryRoot, 'assets', 'suhbah-logo-display.webp'));
    fs.writeFileSync(path.join(temporaryRoot, 'assets', 'test.txt'), 'public asset');
    const email = 'admin@example.test';
    const password = 'test-only-password';
    fs.writeFileSync(path.join(temporaryRoot, 'data', 'suhbah-db.json'), JSON.stringify({
      adminUsers: [{ id: 'admin-1', name: 'Test Admin', email, passwordHash: crypto.createHash('sha256').update(password).digest('hex') }],
      events: [
        { id: 'test-event', number: 'Suhbah 03', theme: 'Finding Your Way Back', date: '2026-10-24', time: '10:00 AM', location: 'Bengaluru', status: 'upcoming', registrationStatus: 'Open', description: 'A gathering for reflection.' },
        { id: 'past-event', number: 'Suhbah 01', theme: 'How the Quran changes you', date: '2026-08-22', time: '10:00 AM', location: 'Bengaluru', status: 'past', registrationStatus: 'Closed', description: 'Our first gathering.' },
      ], testimonials: [], registrations: [], communityStats: {}, socialLinks: {},
    }));
    const port = await new Promise((resolve, reject) => {
      const listener = net.createServer();
      listener.on('error', reject);
      listener.listen(0, '127.0.0.1', () => {
        const port = listener.address().port;
        listener.close(() => resolve(port));
      });
    });
    server = spawn(process.execPath, ['server.js'], {
      cwd: temporaryRoot,
      env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), POSTGRES_URL: '', DATABASE_URL: '', VERCEL: '', GMAIL_APP_PASSWORD: '', PORT: String(port), ADMIN_EMAIL: email, ADMIN_PASSWORD: password },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
      server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    const base = `http://127.0.0.1:${port}`;
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(base);
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
    }
    for (const endpoint of ['/api/admin', '/api/admin/events', '/api/admin/testimonials', '/api/admin/statistics', '/api/admin/social']) {
      const response = await request.fetch(`${base}${endpoint}`, { method: endpoint === '/api/admin' ? 'GET' : 'PUT', data: {} });
      expect(response.status()).toBe(401);
    }
    expect((await request.get(`${base}/api/admin`, { headers: { Cookie: 'suhbah_session=fake' } })).status()).toBe(401);
    for (const privatePath of ['/data/suhbah-db.json', '/server.js', '/package.json', '/.git/config', '/assets/..%5Cdata%5Csuhbah-db.json']) {
      expect((await request.get(`${base}${privatePath}`)).status()).toBe(404);
    }
    expect((await request.get(`${base}/assets/test.txt`)).status()).toBe(200);
    await page.goto(`${base}/admin`);
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('.admin-shell')).toHaveCount(0);
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="password"]').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Invalid admin credentials.')).toBeVisible();
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('.admin-shell')).toBeVisible();
    await expect(page.locator('a[href="/admin"]')).toHaveCount(1);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: test.info().outputPath('admin-desktop.png'), fullPage: true });
    expect((await page.locator('.admin-event-card').first().boundingBox()).height).toBeLessThan(350);
    await page.locator('[data-edit-event="test-event"]').click();
    await expect(page.locator('[name="theme"]')).toHaveValue('Finding Your Way Back');
    await page.locator('[name="theme"]').fill('Finding Your Way Back - updated');
    const communityGroupLink = 'https://chat.whatsapp.com/test-monthly-group';
    await page.locator('[name="communityGroupLink"]').fill(communityGroupLink);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.admin-event-card').first()).toContainText('Finding Your Way Back - updated');
    await page.locator('[data-edit-event="test-event"]').click();
    await expect(page.locator('[name="communityGroupLink"]')).toHaveValue(communityGroupLink);
    await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
    await expect(page.locator('[name="theme"]')).toHaveValue('');
    for (const tab of ['registrations', 'testimonials', 'statistics', 'social', 'events']) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await expect(page.locator('.admin-content')).toHaveAttribute('aria-label', tab);
      if (tab === 'social') {
        await expect(page.locator('#socialForm [name="youtube"]')).toHaveCount(0);
        await expect(page.locator('#socialForm [name="instagram"]')).toBeVisible();
        await expect(page.locator('#socialForm [name="whatsapp"]')).toBeVisible();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: test.info().outputPath('admin-mobile.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const dashboard = await page.request.get(`${base}/api/admin`);
    expect(dashboard.status()).toBe(200);
    expect(await dashboard.json()).not.toHaveProperty('adminUsers');
    await page.locator('#logoutButton').click();
    await expect(page.locator('#loginForm')).toBeVisible();
    expect((await page.request.get(`${base}/api/admin`)).status()).toBe(401);
    await page.goto(`${base}/register/test-event`);
    await expect(page.locator('#registrationForm')).toContainText("After registration, you will be taken to the WhatsApp group for this month's Suhbah gathering.");
    await expect(page.locator('#registrationForm .community-group-link')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const [name, value] of Object.entries({ name: 'Test Attendee', email: 'attendee@example.test', phone: '9876543210', age: '23' })) {
      await page.locator(`#registrationForm [name="${name}"]`).fill(value);
    }
    await expect(page.locator('#receivedQuranField')).toBeHidden();
    await page.locator('[name="attendedBefore"][value="Yes"]').check();
    await expect(page.locator('#receivedQuranField')).toBeVisible();
    await expect(page.locator('[name="receivedQuran"]')).toHaveAttribute('required', '');
    await expect(page.locator('[name="receivedQuran"]')).toHaveValue('');
    await page.locator('[name="receivedQuran"]').selectOption('Yes');
    await page.locator('[name="attendedBefore"][value="No"]').check();
    await expect(page.locator('#receivedQuranField')).toBeHidden();
    await expect(page.locator('[name="receivedQuran"]')).toHaveValue('Not applicable');
    await expect(page.locator('[name="receivedQuran"]')).not.toHaveAttribute('required');
    for (const [name, value] of Object.entries({ gender: 'Female', profile: 'Student', source: 'WhatsApp' })) {
      await page.locator(`#registrationForm [name="${name}"]`).selectOption(value);
    }
    await page.route('**/api/registrations', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Please try again.' }) }));
    await page.getByRole('button', { name: 'Reserve My Spot', exact: true }).click();
    await expect(page.locator('#registrationForm [role="alert"]')).toHaveText('Please try again.');
    await expect(page).toHaveURL(`${base}/register/test-event`);
    await page.unroute('**/api/registrations');
    // Keep the browser local while verifying the exact external invite destination.
    await page.route(communityGroupLink, (route) => route.fulfill({ contentType: 'text/html', body: '<h1>WhatsApp group invite</h1>' }));
    await page.getByRole('button', { name: 'Reserve My Spot', exact: true }).click();
    await expect(page).toHaveURL(communityGroupLink);
    const savedDb = JSON.parse(fs.readFileSync(path.join(temporaryRoot, 'data', 'suhbah-db.json'), 'utf8'));
    expect(savedDb.registrations).toHaveLength(1);
    expect(savedDb.registrations[0]).toMatchObject({ eventId: 'test-event', email: 'attendee@example.test' });
    expect(savedDb.registrations[0].confirmationEmailStatus).toBe('not_configured');
    const registrationId = savedDb.registrations[0].id;
    expect((await request.delete(`${base}/api/admin/registrations`, { data: { id: registrationId } })).status()).toBe(401);
    await page.goto(`${base}/admin`);
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.locator('[data-tab="registrations"]').click();
    const deleteButton = page.getByRole('button', { name: 'Delete registration for Test Attendee', exact: true });
    for (const width of [320, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const table = page.locator('.table-wrap');
      const bounds = await table.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const overflows = await table.evaluate((element) => element.scrollWidth > element.clientWidth);
      if (width <= 768) expect(overflows).toBe(true);
      await table.focus();
      if (overflows) {
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        await table.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        await expect.poll(() => table.evaluate((element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 1)).toBe(true);
      }
      const actionBounds = await deleteButton.boundingBox();
      expect(actionBounds.x).toBeGreaterThanOrEqual(bounds.x);
      expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      if (width === 390) await page.screenshot({ path: test.info().outputPath('admin-registrations-mobile.png'), fullPage: true });
      await table.evaluate((element) => { element.scrollLeft = 0; });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (browserName === 'chromium') {
      const table = page.locator('.table-wrap');
      await table.scrollIntoViewIfNeeded();
      const bounds = await table.boundingBox();
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const y = Math.round(bounds.y + 70);
      const startX = Math.round(bounds.x + bounds.width - 20);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
      for (let offset = 20; offset <= 200; offset += 20) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - offset, y }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      await session.detach();
    }
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Test Attendee');
      expect(dialog.message()).toContain('cannot be undone');
      await dialog.dismiss();
    });
    await deleteButton.click();
    await expect(deleteButton).toBeEnabled();
    expect((await (await page.request.get(`${base}/api/admin`)).json()).registrations).toHaveLength(1);
    expect((await page.request.delete(`${base}/api/admin/registrations`, { data: {} })).status()).toBe(400);
    expect((await page.request.delete(`${base}/api/admin/registrations`, { data: { id: 'missing' } })).status()).toBe(404);
    await page.route('**/api/admin/registrations', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Deletion unavailable. Try again.' }) }));
    page.once('dialog', (dialog) => dialog.accept());
    await deleteButton.click();
    await expect(page.getByRole('alert')).toHaveText('Deletion unavailable. Try again.');
    await expect(deleteButton).toBeEnabled();
    await page.unroute('**/api/admin/registrations');
    page.once('dialog', (dialog) => dialog.accept());
    await deleteButton.click();
    await expect(deleteButton).toHaveCount(0);
    await expect(page.locator('tbody')).toContainText('No registrations for this selection.');
    await page.reload();
    await page.locator('[data-tab="registrations"]').click();
    await expect(page.locator('tbody')).toContainText('No registrations for this selection.');
    expect(JSON.parse(fs.readFileSync(path.join(temporaryRoot, 'data', 'suhbah-db.json'), 'utf8')).registrations).toHaveLength(0);
    await page.goto(`${base}/register/past-event`);
    await expect(page.locator('#registrationMount .community-group-link')).toHaveCount(0);
  } finally {
    if (server && server.exitCode === null) {
      await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
