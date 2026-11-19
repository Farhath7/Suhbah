const { test, expect } = require('playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

test('Suhbah 04 is publicly visible and accepts registrations for December 6', async ({ page, request }) => {
  const root = path.resolve(__dirname, '..');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-four-'));
  const database = path.join(workspace, 'data', 'suhbah-db.json');
  let server;
  try {
    for (const file of ['server.js', 'storage.js', 'registration-email.js', 'index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']) {
      fs.copyFileSync(path.join(root, file), path.join(workspace, file));
    }
    fs.mkdirSync(path.dirname(database));
    fs.writeFileSync(database, JSON.stringify({
      adminUsers: [], events: [{ id: 'event-7', number: 'Suhbah 03', theme: 'Did I think ?', date: '2026-11-01', time: '3:00 - 5:00 PM', status: 'past', registrationStatus: 'Closed' }],
      registrations: [{ id: 'existing-third', eventId: 'event-7', email: 'old@example.test' }],
      testimonials: [], communityStats: {}, socialLinks: {},
    }));
    const bootstrap = "const http = require('http'); const listen = http.Server.prototype.listen; " +
      "http.Server.prototype.listen = function (...args) { this.once('listening', () => " +
      "console.log('TEST_PORT=' + this.address().port)); return listen.apply(this, args); }; require('./server');";
    server = spawn(process.execPath, ['-e', bootstrap], {
      cwd: workspace, windowsHide: true,
      env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), PORT: '0',
        SUHBAH_DATA_DIR: path.dirname(database), POSTGRES_URL: '', DATABASE_URL: '', VERCEL: '',
        GMAIL_APP_PASSWORD: '', ADMIN_EMAIL: '', ADMIN_PASSWORD: '' },
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
    const data = await (await request.get(`${base}/api/public`)).json();
    expect(data.events.find(event => event.id === 'event-7').number).toBe('Suhbah #03');
    expect(data.events.filter((event) => event.number === 'Suhbah 04')).toHaveLength(1);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/#register`);
      await expect(page.locator('#registrationForm')).toBeVisible();
      await expect(page.locator('#registrationForm [name="eventId"]')).toHaveValue('event-suhbah-04');
      await expect(page.locator('#register')).toContainText('6 December 2026');
      await expect(page.locator('#register')).toContainText('3:00 - 5:00 PM');
      await expect(page.locator('#register')).toContainText('Theme to be announced');
      await expect(page.locator('#register')).toContainText('Venue to be announced');
      await expect(page.locator('#register .event-map-link')).toHaveCount(0);
    }
    await page.goto(`${base}/register/event-suhbah-04`);
    await page.locator('[name="name"]').fill('Sample attendee');
    await page.locator('[name="email"]').fill('sample@example.test');
    await page.locator('[name="phone"]').fill('0000000000');
    await page.locator('[name="age"]').fill('22');
    await page.locator('[name="gender"]').selectOption('Female');
    await page.locator('[name="profile"]').selectOption('Student');
    await page.locator('[name="attendedBefore"][value="No"]').check();
    await page.locator('[name="source"]').selectOption('Friend');
    await page.getByRole('button', { name: 'Reserve My Spot', exact: true }).click();
    await expect(page.locator('.success-panel')).toContainText('Your spot is reserved for Suhbah 04');
    const saved = JSON.parse(fs.readFileSync(database, 'utf8'));
    expect(saved.registrations).toHaveLength(2);
    expect(saved.registrations.find((reg) => reg.email === 'sample@example.test').eventId).toBe('event-suhbah-04');
    expect(saved.registrations.find((reg) => reg.id === 'existing-third')).toBeTruthy();
    expect(saved.events.filter((event) => event.number === 'Suhbah 04')).toHaveLength(1);
    await page.reload();
    await expect(page.locator('#registrationForm')).toBeVisible();
    expect((await (await request.get(`${base}/api/public`)).json()).events.filter((event) => event.number === 'Suhbah 04')).toHaveLength(1);
  } finally {
    if (server && server.exitCode === null) await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    expect(path.resolve(workspace).startsWith(path.resolve(os.tmpdir()) + path.sep)).toBe(true);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
