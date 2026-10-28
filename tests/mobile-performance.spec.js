const { test, expect } = require('playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const baseline = process.env.PERF_BASELINE === '1';
let server, base;
const event = { id: 'event-3', number: 'Suhbah 03', theme: 'Trials That Define Us', date: '2026-11-21', time: '5 PM', location: 'Bengaluru', status: 'upcoming', registrationStatus: 'Open', description: 'Reflect and reconnect.', image: '/assets/suhbah-03-trials-that-define-us.webp' };
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/public') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ events: [event, ...['01-quran-changes-you', '02-whos-in-your-cave'].map((name, i) => ({ ...event, id: `past-${i}`, status: 'past', image: `/assets/suhbah-${name}.png` }))], testimonials: [], communityStats: {}, socialLinks: {} }));
    }
    const name = pathname === '/' || pathname.startsWith('/register/') ? 'index.html' : pathname.slice(1);
    if (name.includes('..')) { res.writeHead(403); return res.end(); }
    try {
      const data = baseline && ['index.html','suhbah.js','suhbah.css'].includes(name)
        ? execFileSync('git', ['show', `origin/main:${name}`], { cwd: root, maxBuffer: 1024 * 1024 })
        : fs.readFileSync(path.join(root, name));
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
      res.setHeader('Content-Type', types[path.extname(name)] || 'application/octet-stream');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

test('mobile images have a small transfer budget and load through the registration flow', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(base);
  await expect(page.locator('.hero h1')).toBeVisible();
  await page.locator('.past-grid').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.past-image img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), { timeout: 60000 }).toBe(true);
  await page.locator('#register').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.registration-art img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  const metrics = await page.evaluate(() => {
    const images = performance.getEntriesByType('resource').filter(entry => /\.(png|webp|jpg)(\?|$)/.test(entry.name));
    return { imageBytes: images.reduce((sum, entry) => sum + entry.decodedBodySize, 0), images: images.map(entry => ({ file: entry.name.split('/').pop(), bytes: entry.decodedBodySize })), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  console.log(JSON.stringify({ baseline, ...metrics }));
  expect(metrics.overflow).toBe(false);
  if (!baseline) {
    expect(metrics.imageBytes).toBeLessThan(450000);
    expect(metrics.images.some(image => /suhbah-logo\.png|registration-still-life\.png|quran-changes-you\.png|whos-in-your-cave\.png/.test(image.file))).toBe(false);
    await expect(page.locator('.event-poster')).toHaveAttribute('fetchpriority', 'high');
    await expect(page.locator('.registration-art img')).toHaveAttribute('loading', 'lazy');
    expect(await page.locator('.live-sky').evaluate(el => getComputedStyle(el, '::before').animationName)).toBe('none');
  }
  await page.screenshot({ path: `test-results/${baseline ? 'baseline' : 'optimized'}-mobile-registration.png` });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({ path: `test-results/${baseline ? 'baseline' : 'optimized'}-mobile-home.png` });
  await page.locator('.event-reserve-button').click();
  await expect(page.locator('#registrationForm')).toBeVisible({ timeout: 10000 });
  expect(errors).toEqual([]);
});

test('desktop poster decodes and retains the animated sky', async ({ page }) => {
  test.skip(baseline);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await expect.poll(() => page.locator('.event-poster').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.locator('.live-sky').evaluate(el => getComputedStyle(el, '::before').animationName)).toBe('sky-cloud-drift');
  await page.screenshot({ path: 'test-results/optimized-desktop-home.png' });
});
