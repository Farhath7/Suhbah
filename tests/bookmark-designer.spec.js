const { test, expect } = require('playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

test('Arabic bookmark templates download the exact preview and work on mobile', async ({ page }) => {
  const root = path.resolve(__dirname, '..');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-bookmark-test-'));
  let server;
  try {
    for (const file of ['server.js', 'index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']) {
      fs.copyFileSync(path.join(root, file), path.join(temporaryRoot, file));
    }
    fs.mkdirSync(path.join(temporaryRoot, 'assets'));
    for (const file of ['suhbah-logo.png', 'bookmark-palestine.jpg', 'bookmark-olive-heritage.png', 'bookmark-jerusalem-stories.png', 'bookmark-watermelon-keffiyeh.png']) {
      fs.copyFileSync(path.join(root, 'assets', file), path.join(temporaryRoot, 'assets', file));
    }
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
      env: { ...process.env, PORT: String(port) },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
      server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/bookmarks`);
    const downloadButton = page.locator('#bookmarkDownload');
    const name = page.locator('#bookmarkName');
    await expect(downloadButton).toBeDisabled();
    await name.fill('Aisha');
    await expect(downloadButton).toBeDisabled();
    await name.fill('\u0639\u0628\u062f \u0627\u0644\u0631\u062d\u0645\u0646');
    for (const template of ['palestine', 'heritage', 'jerusalem', 'watermelon', 'olive', 'midnight', 'rose']) {
      await page.locator(`input[value="${template}"]`).check();
      await expect(downloadButton).toBeEnabled();
      const preview = await page.locator('#bookmarkCanvas').evaluate((canvas) => ({
        data: canvas.toDataURL(), width: canvas.width, height: canvas.height,
      }));
      const pending = page.waitForEvent('download');
      await downloadButton.click();
      const download = await pending;
      expect(download.suggestedFilename()).toBe(`suhbah-bookmark-${template}.png`);
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const png = Buffer.concat(chunks);
      expect(`data:image/png;base64,${png.toString('base64')}`).toBe(preview.data);
      expect(png.readUInt32BE(16)).toBe(preview.width);
      expect(png.readUInt32BE(20)).toBe(preview.height);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.locator('input[value="watermelon"]').check();
    await name.fill('\u0639\u0628\u062f \u0627\u0644\u0631\u062d\u0645\u0646 '.repeat(3).trim());
    await expect(downloadButton).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
