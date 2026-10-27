const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = {
  events: Array.from({ length: 4 }, (_, i) => ({ id: `past-${i}`, number: `Suhbah ${i + 1}`, theme: `Gathering ${i + 1}`, status: 'past', date: '2026-10-01', time: '3 PM', location: 'Bangalore', description: 'Reflect on the Quran.' })),
  testimonials: [], communityStats: {}, socialLinks: {},
};

test('share dialog, exports, copy fallbacks and mobile previous gatherings', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    for (const scenario of [{ width: 1440 }, { width: 390 }, { width: 700 }, { width: 390, clipboard: 'pending' }, { width: 390, clipboard: 'denied' }]) {
      const page = await browser.newPage({ viewport: { width: scenario.width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const file = { '/': 'index.html', '/suhbah.js': 'suhbah.js', '/quran-library.js': 'quran-library.js', '/suhbah.css': 'suhbah.css' }[url.pathname];
        if (url.pathname === '/api/public') return route.fulfill({ json: fixture });
        if (file) return route.fulfill({ path: path.join(root, file) });
        if (url.pathname.startsWith('/assets/fonts/') && fs.existsSync(path.join(root, url.pathname))) return route.fulfill({ path: path.join(root, url.pathname) });
        return route.fulfill({ status: 204 });
      });
      await page.addInitScript((scenario) => {
        window.copied = ''; window.copiedImageSize = 0;
        Object.defineProperty(navigator, 'share', { value: () => { throw new Error('Must not open native sharing'); } });
        Object.defineProperty(navigator, 'clipboard', { value: {
          writeText: (text) => {
            if (scenario.clipboard === 'pending') return new Promise(() => {});
            if (scenario.clipboard === 'denied') return Promise.reject(new Error('Denied'));
            window.copied = text; return Promise.resolve();
          },
          write: async (items) => { window.copiedImageSize = (await items[0].getType('image/png')).size; },
        } });
      }, scenario);
      await page.goto('https://suhbah.test/');
      await page.locator('#shareWeeklyVerse').click();
      assert.equal(await page.locator('#verseShareDialog').isVisible(), true);
      assert.equal(await page.evaluate(() => window.copied), '', 'Opening dialog does not copy text');
      assert.equal(await page.getByText('Generate Media', { exact: true }).count(), 0);
      const verseUrl = await page.locator('#verseShareLink').inputValue();
      await page.locator('[data-share-action=link]').click();
      if (scenario.clipboard) {
        await page.waitForFunction(() => !document.querySelector('.verse-share-manual').hidden);
        assert.equal(await page.locator('.verse-share-manual').inputValue(), verseUrl);
        assert.equal(await page.locator('[data-share-action=link]').isEnabled(), true);
      } else {
        await page.waitForFunction(() => document.querySelector('.verse-share-status').textContent.includes('Link copied'));
        assert.equal(await page.evaluate(() => window.copied), verseUrl);
        await page.locator('[data-verse-mode=surah]').click();
        const surahUrl = await page.locator('#verseShareLink').inputValue();
        assert.match(surahUrl, /startingVerse=/);
        for (const name of ['facebook', 'x', 'whatsapp']) {
          const target = new URL(await page.locator(`[data-share-social=${name}]`).getAttribute('href'));
          assert.ok([...target.searchParams.values()].some((value) => value.includes(surahUrl)), `${name} uses selected link`);
        }
        await page.locator('[data-share-action=embed]').click();
        await page.waitForFunction(() => document.querySelector('.verse-share-status').textContent.includes('Embed code copied'));
        const embed = await page.evaluate(() => {
          const container = document.createElement('div'); container.innerHTML = window.copied;
          return { tag: container.firstElementChild.tagName, srcdoc: container.firstElementChild.srcdoc };
        });
        assert.equal(embed.tag, 'IFRAME');
        assert.ok(embed.srcdoc.includes(surahUrl));
        assert.ok(embed.srcdoc.includes(await page.locator('.weekly-verse-translation').textContent()));
        await page.locator('[data-share-action=image]').click();
        await page.waitForFunction(() => !document.querySelector('.verse-share-media').hidden);
        await page.locator('[data-share-action=copy-image]').click();
        await page.waitForFunction(() => window.copiedImageSize > 0);
        const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-share-action=download]').click()]);
        assert.match(download.suggestedFilename(), /^suhbah-verse-\d+-\d+\.png$/);
        assert.equal(await download.failure(), null);
        const imagePath = await download.path();
        assert.deepEqual([...fs.readFileSync(imagePath).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        if (process.env.SUHBAH_QA_DIR) fs.copyFileSync(imagePath, path.join(process.env.SUHBAH_QA_DIR, `verse-export-${scenario.width}.png`));
        await page.keyboard.press('Escape');
        await page.locator('#verseShareDialog').waitFor({ state: 'detached' });
        assert.equal(await page.locator('#verseShareDialog').count(), 0);
        assert.equal(await page.locator('#shareWeeklyVerse').evaluate((button) => button === document.activeElement), true);
        await page.locator('#shareWeeklyVerse').click();
        if (process.env.SUHBAH_QA_DIR) await page.screenshot({ path: path.join(process.env.SUHBAH_QA_DIR, `verse-dialog-${scenario.width}.png`) });
      }
      await page.getByRole('button', { name: 'Close sharing dialog' }).click();
      await page.locator('#verseShareDialog').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#verseShareDialog').count(), 0);
      const layout = await page.locator('.past-grid').evaluate((grid) => {
        const cards = [...grid.children].map((card) => card.getBoundingClientRect());
        return { sameRow: cards.every((card) => Math.abs(card.top - cards[0].top) < 1), scrolls: grid.scrollWidth > grid.clientWidth, pageOverflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.pageOverflow, false);
      if (scenario.width < 900) {
        assert.equal(layout.sameRow, true);
        assert.equal(layout.scrolls, true);
        await page.locator('.past-grid').evaluate((grid) => { grid.scrollLeft = grid.scrollWidth; });
        await page.waitForFunction(() => document.querySelector('.past-grid').scrollLeft > 0);
        await page.locator('.past-card').last().click();
        assert.equal(await page.locator('.recap-dialog').isVisible(), true);
        await page.getByRole('button', { name: 'Close recap' }).click();
      }
      assert.deepEqual(errors, []);
      console.log(`Passed ${scenario.width}px, clipboard ${scenario.clipboard || 'available'}`);
      await page.close();
    }
  } finally { await browser.close(); }
});
