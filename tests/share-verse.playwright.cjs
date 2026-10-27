const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const fixture = {
  events: [], testimonials: [], communityStats: {}, socialLinks: {},
};

test('verse sharing recovers from stalled native dialogs and clipboard requests', { timeout: 45000 }, async () => {
  const browser = await chromium.launch();
  try {
    for (const scenario of [
      { name: 'desktop bypasses native share', mobile: false, share: 'pending', clipboard: 'success', expected: 'copied' },
      { name: 'mobile native sharing', mobile: true, share: 'success', clipboard: 'success', expected: 'Verse shared.' },
      { name: 'mobile cancellation', mobile: true, share: 'cancel', clipboard: 'success', expected: 'cancelled' },
      { name: 'native failure copies verse', mobile: true, share: 'failure', clipboard: 'success', expected: 'copied' },
      { name: 'stalled native dialog recovers', mobile: true, share: 'pending', clipboard: 'success', expected: 'copied' },
      { name: 'stalled clipboard offers manual copy', mobile: false, share: 'pending', clipboard: 'pending', expected: 'Select and copy' },
      { name: 'denied clipboard offers manual copy', mobile: false, share: 'pending', clipboard: 'failure', expected: 'Select and copy' },
      { name: 'unsupported sharing offers manual copy', mobile: true, share: 'missing', clipboard: 'missing', expected: 'Select and copy' },
    ]) {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const file = { '/': 'index.html', '/suhbah.js': 'suhbah.js', '/quran-library.js': 'quran-library.js', '/suhbah.css': 'suhbah.css' }[url.pathname];
        if (url.pathname === '/api/public') return route.fulfill({ json: fixture });
        if (file) return route.fulfill({ path: path.join(root, file) });
        return route.fulfill({ status: 204 });
      });
      await page.addInitScript((scenario) => {
        window.shareCalls = 0;
        window.copied = '';
        Object.defineProperty(navigator, 'userAgentData', { value: { mobile: scenario.mobile } });
        Object.defineProperty(navigator, 'share', { value: scenario.share === 'missing' ? undefined : () => {
          window.shareCalls++;
          if (scenario.share === 'pending') return new Promise(() => {});
          if (scenario.share === 'cancel') return Promise.reject(new DOMException('Cancelled', 'AbortError'));
          if (scenario.share === 'failure') throw new Error('Unavailable');
          return Promise.resolve();
        } });
        Object.defineProperty(navigator, 'clipboard', { value: scenario.clipboard === 'missing' ? undefined : { writeText: (text) => {
          if (scenario.clipboard === 'pending') return new Promise(() => {});
          if (scenario.clipboard === 'failure') return Promise.reject(new Error('Denied'));
          window.copied = text;
          return Promise.resolve();
        } } });
      }, scenario);
      await page.goto('https://suhbah.test/');
      await page.locator('#shareWeeklyVerse').click();
      await page.waitForFunction((expected) => document.getElementById('weeklyVerseShareStatus')?.textContent.includes(expected), scenario.expected, { timeout: 12000 });
      assert.equal(await page.locator('#shareWeeklyVerse').isEnabled(), true, scenario.name);
      assert.deepEqual(errors, [], scenario.name);
      if (!scenario.mobile) assert.equal(await page.evaluate(() => window.shareCalls), 0, scenario.name);
      if (scenario.expected === 'copied') {
        const copied = await page.evaluate(() => window.copied);
        assert.ok(copied.includes(await page.locator('.weekly-verse-arabic').textContent()));
        assert.ok(copied.includes(await page.locator('.weekly-verse-translation').textContent()));
        assert.ok(copied.includes('https://quran.com/'));
      }
      if (scenario.expected === 'Select and copy') {
        assert.equal(await page.locator('#weeklyVerseShareText').isVisible(), true);
        assert.match(await page.locator('#weeklyVerseShareText').inputValue(), /https:\/\/quran.com\//);
      }
      if (scenario.share === 'pending' && scenario.mobile) {
        await page.locator('#shareWeeklyVerse').click();
        await page.waitForFunction(() => document.getElementById('weeklyVerseShareStatus').textContent.includes('copied'));
        assert.equal(await page.evaluate(() => window.shareCalls), 1, 'Do not reopen a stalled native dialog');
      }
      console.log(`Passed: ${scenario.name}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
