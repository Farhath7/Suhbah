const { test, expect } = require('playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

test('weekly verse follows the India week and shares with safe fallbacks', async ({ page, request }) => {
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
    await page.clock.install({ time: new Date('2026-10-26T06:00:00Z') });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedVerse = text; } } });
    });
    await page.goto(base);
    const section = page.locator('#verse-of-the-week');
    expect(await section.evaluate((el) => el.parentElement.parentElement.previousElementSibling.classList.contains('cta'))).toBe(true);

    await expect(section).toContainText('18:110');
    await expect(section.locator('[lang="ar"]')).toHaveAttribute('dir', 'rtl');
    await section.getByRole('button', { name: 'Share verse' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Verse and Quran.com link copied.' })).toBeVisible();
    expect(await page.evaluate(() => window.copiedVerse)).toContain('https://quran.com/18/110');
    await page.evaluate(() => { navigator.share = async (data) => { window.sharedVerse = data; }; });
    await section.getByRole('button', { name: 'Share verse' }).click();
    expect(await page.evaluate(() => window.sharedVerse.url)).toBe('https://quran.com/18/110');
    await page.evaluate(() => { navigator.share = async () => { throw new DOMException('Cancelled', 'AbortError'); }; window.copiedVerse = ''; });
    await section.getByRole('button', { name: 'Share verse' }).click();
    await expect(section.getByRole('button', { name: 'Share verse' })).toBeEnabled();
    expect(await page.evaluate(() => window.copiedVerse)).toBe('');
    await page.evaluate(() => { navigator.share = async () => { throw new Error('Unavailable'); }; });
    await section.getByRole('button', { name: 'Share verse' }).click();
    expect(await page.evaluate(() => window.copiedVerse)).toContain('18:110');
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
    await section.getByRole('button', { name: 'Share verse' }).click();
    await expect(page.getByRole('textbox', { name: 'Verse text to copy and share' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Verse text to copy and share' })).toHaveValue(/https:\/\/quran.com\/18\/110/);
    await page.clock.setFixedTime(new Date('2026-11-01T18:29:59Z'));
    await page.reload();
    await expect(section).toContainText('18:110');
    await page.clock.setFixedTime(new Date('2026-11-01T18:30:00Z'));
    await page.reload();
    await expect(section).toContainText('2:152');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole('button', { name: 'Share verse' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  } finally {
    if (server && server.exitCode === null) {
      await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
