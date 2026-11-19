const { test, expect } = require('playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

test('completed Suhbah registrations require an export warning and delete only the selected event', async ({ page, request }, testInfo) => {
  const root = path.resolve(__dirname, '..');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-bulk-delete-'));
  const database = path.join(workspace, 'data', 'suhbah-db.json');
  const email = 'admin@example.test';
  const password = 'test-only-password';
  let server;
  try {
    // Isolate all writes from repository data, credentials, and production storage.
    for (const file of ['server.js', 'storage.js', 'registration-email.js', 'index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']) {
      fs.copyFileSync(path.join(root, file), path.join(workspace, file));
    }
    fs.mkdirSync(path.dirname(database));
    const events = ['past', 'upcoming', 'draft'].map((status) => ({ id: status, number: `Suhbah ${status}`, theme: 'Test gathering', status, registrationStatus: 'Closed', date: '2026-11-01' }));
    const registrations = ['past', 'past', 'upcoming', 'draft', 'archived'].map((eventId, index) => ({
      id: `reg-${index}`, eventId, eventNumber: `Suhbah ${eventId}`, name: `Attendee ${index}`,
      email: `attendee-${index}@example.test`, phone: '0000000000', age: '20', createdAt: '2026-11-01T00:00:00Z',
    }));
    fs.writeFileSync(database, JSON.stringify({
      adminUsers: [{ id: 'admin-1', name: 'Test Admin', email, passwordHash: crypto.createHash('sha256').update(password).digest('hex') }],
      events, registrations, testimonials: [], communityStats: {}, socialLinks: {},
    }));
    const bootstrap = "const http = require('http'); const listen = http.Server.prototype.listen; " +
      "http.Server.prototype.listen = function (...args) { this.once('listening', () => " +
      "console.log('TEST_PORT=' + this.address().port)); return listen.apply(this, args); }; require('./server');";
    server = spawn(process.execPath, ['-e', bootstrap], {
      cwd: workspace, windowsHide: true,
      env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), PORT: '0',
        SUHBAH_DATA_DIR: path.dirname(database), POSTGRES_URL: '', DATABASE_URL: '', VERCEL: '',
        GMAIL_APP_PASSWORD: '', ADMIN_EMAIL: email, ADMIN_PASSWORD: password },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      server.once('error', (error) => { clearTimeout(timer); reject(error); });
      server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
      server.stdout.on('data', (chunk) => {
        const port = String(chunk).match(/TEST_PORT=(\d+)/);
        if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port[1]}`); }
      });
    });
    const saved = () => JSON.parse(fs.readFileSync(database, 'utf8'));
    const endpoint = `${base}/api/admin/registrations`;
    expect((await request.delete(endpoint, { data: { eventId: 'past', exportConfirmed: true } })).status()).toBe(401);
    await request.post(`${base}/api/login`, { data: { email, password } });
    for (const [data, status] of [
      [{}, 400], [{ eventId: '' }, 400], [{ eventId: null }, 400],
      [{ eventId: 'past', id: 'reg-0', exportConfirmed: true }, 400],
      [{ eventId: 'missing', exportConfirmed: true }, 404],
      [{ eventId: 'past' }, 400], [{ eventId: 'past', exportConfirmed: 'true' }, 400],
      [{ eventId: 'upcoming', exportConfirmed: true }, 409],
      [{ eventId: 'draft', exportConfirmed: true }, 409],
    ]) {
      expect((await request.delete(endpoint, { data })).status()).toBe(status);
      expect(saved().registrations).toEqual(registrations);
    }
    await page.goto(`${base}/admin`);
    await page.locator('#loginForm [name="email"]').fill(email);
    await page.locator('#loginForm [name="password"]').fill(password);
    await page.locator('#loginForm button[type="submit"]').click();
    await page.locator('[data-tab="registrations"]').click();
    const bulkDelete = page.locator('#deleteEventRegistrations');
    await expect(bulkDelete).toBeDisabled();
    await page.locator('#registrationEventFilter').selectOption('upcoming');
    await expect(bulkDelete).toBeDisabled();
    await page.locator('#registrationEventFilter').selectOption('past');
    await expect(bulkDelete).toBeEnabled();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await bulkDelete.click();
      const dialog = page.getByRole('dialog', { name: 'Delete registrations?' });
      await expect(dialog).toContainText('Suhbah past: Test gathering');
      await expect(dialog).toContainText('2 registrations');
      await expect(dialog).toContainText('cannot be undone');
      await expect(dialog.locator('[data-confirm-delete]')).toBeDisabled();
      const bounds = await dialog.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`delete-warning-${width}.png`) });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(saved().registrations).toEqual(registrations);
    }
    await bulkDelete.click();
    const dialog = page.getByRole('dialog');
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export CSV (Excel)', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('suhbah-past-registrations.csv');
    const csv = fs.readFileSync(await download.path(), 'utf8');
    expect(csv).toContain('attendee-0@example.test');
    expect(csv).toContain('attendee-1@example.test');
    expect(csv).not.toContain('attendee-2@example.test');
    await dialog.locator('[data-export-confirmed]').check();
    await expect(dialog.locator('[data-confirm-delete]')).toBeEnabled();
    // A failed request must keep the warning open and allow a retry.
    await page.route('**/api/admin/registrations', (route) => route.fulfill({ status: 500, json: { error: 'Please retry deletion.' } }), { times: 1 });
    await dialog.locator('[data-confirm-delete]').click();
    await expect(dialog.getByRole('alert')).toHaveText('Please retry deletion.');
    expect(saved().registrations).toEqual(registrations);
    await dialog.locator('[data-confirm-delete]').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('tbody')).toContainText('No registrations for this selection.');
    await expect(bulkDelete).toBeDisabled();
    expect(saved().registrations).toEqual(registrations.filter((reg) => reg.eventId !== 'past'));
    expect(saved().events).toEqual(events);
    await page.reload();
    await page.locator('[data-tab="registrations"]').click();
    await page.locator('#registrationEventFilter').selectOption('past');
    await expect(page.locator('tbody')).toContainText('No registrations for this selection.');
    // Archived registrations remain removable after their event record is gone.
    expect((await request.delete(endpoint, { data: { eventId: 'archived', exportConfirmed: true } })).status()).toBe(200);
    expect(saved().registrations).toEqual(registrations.filter((reg) => ['upcoming', 'draft'].includes(reg.eventId)));
    // Existing individual deletion still works.
    expect((await request.delete(endpoint, { data: { id: 'reg-2' } })).status()).toBe(200);
    expect(saved().registrations.map((reg) => reg.id)).toEqual(['reg-3']);
  } finally {
    if (server && server.exitCode === null) await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    expect(path.resolve(workspace).startsWith(path.resolve(os.tmpdir()) + path.sep)).toBe(true);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
