const { test, expect } = require('playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

test('public navigation hides admin and dashboard access requires an admin session', async ({ page, request }) => {
  const root = path.resolve(__dirname, '..');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-admin-test-'));
  let server;
  try {
    for (const file of ['server.js', 'index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']) {
      fs.copyFileSync(path.join(root, file), path.join(temporaryRoot, file));
    }
    fs.mkdirSync(path.join(temporaryRoot, 'data'));
    fs.mkdirSync(path.join(temporaryRoot, 'assets'));
    fs.writeFileSync(path.join(temporaryRoot, 'assets', 'test.txt'), 'public asset');
    const email = 'admin@example.test';
    const password = 'test-only-password';
    fs.writeFileSync(path.join(temporaryRoot, 'data', 'suhbah-db.json'), JSON.stringify({
      adminUsers: [{ id: 'admin-1', name: 'Test Admin', email, passwordHash: crypto.createHash('sha256').update(password).digest('hex') }],
      events: [], testimonials: [], registrations: [], communityStats: {}, socialLinks: {},
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
      env: { ...process.env, PORT: String(port), ADMIN_EMAIL: email, ADMIN_PASSWORD: password },
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
    const dashboard = await page.request.get(`${base}/api/admin`);
    expect(dashboard.status()).toBe(200);
    expect(await dashboard.json()).not.toHaveProperty('adminUsers');
    await page.locator('#logoutButton').click();
    await expect(page.locator('#loginForm')).toBeVisible();
    expect((await page.request.get(`${base}/api/admin`)).status()).toBe(401);
  } finally {
    if (server && server.exitCode === null) {
      await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
