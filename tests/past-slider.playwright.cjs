const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

test('coverflow centers and enlarges covers with arrows, keyboard, scrolling and working recaps', { timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  try {
    for (const [width, count] of [[1440, 6], [1024, 3], [700, 3], [390, 3], [1440, 1], [390, 0]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'no-preference' : 'reduce', hasTouch: width === 390 });
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
      const initial = Math.max(0, Math.floor((count - 1) / 2));
      assert.equal(await page.locator('[data-past-prev]').isDisabled(), initial === 0);
      const layout = await slider.evaluate(grid => {
        return { scrolls: grid.scrollWidth > grid.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false);
      if (count > 1) {
        const arrowPositions = await page.locator('.past-coverflow').evaluate(wrapper => {
          const left = wrapper.querySelector('[data-past-prev]').getBoundingClientRect();
          const right = wrapper.querySelector('[data-past-next]').getBoundingClientRect();
          const bounds = wrapper.getBoundingClientRect();
          return { left: left.left - bounds.left, right: bounds.right - right.right, middle: Math.abs(left.top + left.height / 2 - (bounds.top + bounds.height / 2)), size: left.width };
        });
        assert.ok(arrowPositions.left >= 0 && arrowPositions.left <= 12);
        assert.ok(arrowPositions.right >= 0 && arrowPositions.right <= 12);
        assert.ok(arrowPositions.middle < 1);
        assert.ok(arrowPositions.size >= 44);
        const active = () => page.locator('.past-card.is-centered');
        assert.equal(await active().getAttribute('data-recap-id'), `past-${initial}`);
        const sizes = await slider.evaluate(grid => {
          const center = grid.querySelector('.is-centered').getBoundingClientRect();
          const side = [...grid.children].find(card => !card.classList.contains('is-centered')).getBoundingClientRect();
          const bounds = grid.getBoundingClientRect();
          return { center: center.width, side: side.width, offset: Math.abs(center.x + center.width / 2 - (bounds.x + bounds.width / 2)) };
        });
        assert.ok(sizes.center > sizes.side, 'Centered cover must be larger than side covers');
        assert.ok(sizes.offset < 2, 'Active cover must be centered');
        assert.equal(layout.scrolls, true);
        assert.equal(await page.locator('[data-past-next]').isEnabled(), true);
        await page.locator('[data-past-next]').click();
        await page.waitForFunction(index => document.querySelector('.is-centered')?.dataset.recapId === `past-${index}`, initial + 1);
        await page.locator('[data-past-prev]').click();
        await page.waitForFunction(index => document.querySelector('.is-centered')?.dataset.recapId === `past-${index}`, initial);
        await slider.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(index => document.querySelector('.is-centered')?.dataset.recapId === `past-${index}`, initial + 1);
        await page.keyboard.press('Home');
        await page.waitForFunction(() => document.querySelector('[data-past-prev]').disabled);
        // A side cover comes forward on click, instead of immediately opening its recap.
        await page.locator('.past-card').nth(1).click();
        await page.waitForFunction(() => document.querySelector('.is-centered')?.dataset.recapId === 'past-1');
        assert.equal(await page.locator('.recap-dialog').count(), 0);
        await slider.evaluate(grid => { grid.scrollLeft = grid.scrollWidth; });
        await page.waitForFunction(() => document.querySelector('[data-past-next]').disabled);
        assert.equal(await active().getAttribute('data-recap-id'), `past-${count - 1}`);
        await page.locator('.past-card').last().click();
        assert.equal(await page.locator('.recap-dialog').isVisible(), true);
        await page.getByRole('button', { name: 'Close recap' }).click();
        if (width === 390) {
          await slider.focus();
          await page.keyboard.press('Home');
          await page.waitForFunction(() => document.querySelector('[data-past-prev]').disabled);
          // Exercise native touch scrolling, including the pointer-cancel path.
          await slider.scrollIntoViewIfNeeded();
          const bounds = await slider.boundingBox();
          const client = await page.context().newCDPSession(page);
          const y = Math.max(100, bounds.y + 100);
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y }] });
          for (let step = 1; step <= 8; step++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 320 - step * 30, y }] });
            await page.waitForTimeout(20);
          }
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => document.querySelector('.is-centered')?.dataset.recapId !== 'past-0');
          assert.equal(await page.locator('.recap-dialog').count(), 0);
          await client.detach();
        }
      } else {
        assert.equal(await page.locator('[data-past-next]').isDisabled(), true);
      }
      assert.deepEqual(errors, []);
      console.log(`Passed ${width}px with ${count} previous gatherings`);
      await page.close();
    }
  } finally { await browser.close(); }
});
