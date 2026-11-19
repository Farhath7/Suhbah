const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

test('previous Suhbah slider supports arrows, keyboard, swiping and recaps across screen sizes', { timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  try {
    for (const [width, count] of [[1440, 6], [1024, 3], [700, 3], [390, 3], [1440, 1], [390, 0]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const fixture = {
        events: Array.from({ length: count }, (_, i) => ({ id: `past-${i}`, number: `Suhbah ${i + 1}`, theme: `Gathering ${i + 1}`, status: 'past', date: '2026-10-01', time: '3 PM', location: 'Bangalore', description: 'Reflect on the Quran.' })),
        testimonials: [], registrations: [], communityStats: {}, socialLinks: {},
      };
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        const file = { '/': 'index.html', '/suhbah.js': 'suhbah.js', '/quran-library.js': 'quran-library.js', '/suhbah.css': 'suhbah.css' }[url.pathname];
        if (url.pathname === '/api/public') return route.fulfill({ json: fixture });
        if (file) return route.fulfill({ path: path.join(root, file) });
        return route.fulfill({ status: 204 });
      });
      await page.goto('https://suhbah.test/');
      const slider = page.locator('#pastSuhbahsSlider');
      await slider.waitFor();
      assert.equal(await page.locator('.past-card').count(), count);
      assert.equal(await page.locator('[data-past-prev]').isDisabled(), true);
      const layout = await slider.evaluate(grid => {
        const cards = [...grid.children].map(card => card.getBoundingClientRect());
        return { sameRow: cards.every(card => Math.abs(card.top - cards[0].top) < 1), scrolls: grid.scrollWidth > grid.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false);
      assert.equal(layout.sameRow, true);
      if (count > 1) {
        assert.equal(layout.scrolls, true);
        assert.equal(await page.locator('[data-past-next]').isEnabled(), true);
        await page.locator('[data-past-next]').click();
        await page.waitForFunction(() => !document.querySelector('[data-past-prev]').disabled);
        await page.locator('[data-past-prev]').click();
        await page.waitForFunction(() => document.querySelector('[data-past-prev]').disabled);
        await slider.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('.past-grid').scrollLeft > 0);
        await slider.evaluate(grid => { grid.scrollLeft = grid.scrollWidth; });
        await page.waitForFunction(() => document.querySelector('[data-past-next]').disabled);
        await page.locator('.past-card').last().click();
        assert.equal(await page.locator('.recap-dialog').isVisible(), true);
        await page.getByRole('button', { name: 'Close recap' }).click();
      } else {
        assert.equal(await page.locator('[data-past-next]').isDisabled(), true);
      }
      assert.deepEqual(errors, []);
      console.log(`Passed ${width}px with ${count} previous gatherings`);
      await page.close();
    }
  } finally { await browser.close(); }
});
