const { test, expect } = require('playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

test('Admin edits, registrations and PDFs survive a new release without stale saves', async ({ request }) => {
  const root = path.resolve(__dirname, '..');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-storage-test-'));
  const storage = path.join(workspace, 'persistent-volume');
  const email = 'storage@example.test';
  const password = 'test-only-password';
  const pdf = Buffer.from('%PDF-1.4\nStorage regression test\n%%EOF');
  let server;
  let pending;
  const stop = async () => {
    if (server && server.exitCode === null) {
      await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    }
  };
  const start = async (directory) => {
    const port = await new Promise((resolve, reject) => {
      const listener = net.createServer();
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', () => {
        const assigned = listener.address().port;
        listener.close(() => resolve(assigned));
      });
    });
    server = spawn(process.execPath, ['server.js'], {
      cwd: directory, windowsHide: true,
      env: { ...process.env, PORT: String(port), SUHBAH_DATA_DIR: storage,
        GMAIL_APP_PASSWORD: '', ADMIN_EMAIL: email, ADMIN_PASSWORD: password },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Startup timed out')), 10000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
      server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    });
    return `http://127.0.0.1:${port}`;
  };
  const release = (name, theme) => {
    const directory = path.join(workspace, name);
    fs.mkdirSync(path.join(directory, 'data'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'assets', 'speeches'), { recursive: true });
    for (const file of ['server.js', 'registration-email.js']) {
      fs.copyFileSync(path.join(root, file), path.join(directory, file));
    }
    fs.writeFileSync(path.join(directory, 'assets', 'speeches', 'old-upload.pdf'), pdf);
    fs.writeFileSync(path.join(directory, 'data', 'suhbah-db.json'), JSON.stringify({
      adminUsers: [{ id: 'admin-1', email, passwordHash: crypto.createHash('sha256').update(password).digest('hex') }],
      events: [{ id: 'event-test', number: 'Suhbah 03', theme, status: 'upcoming', registrationStatus: 'Open',
        speechLink: '/assets/speeches/old-upload.pdf' }],
      registrations: [{ id: 'existing-registration', name: 'Existing attendee' }],
      testimonials: [], socialLinks: {}, communityStats: {},
    }));
    return directory;
  };
  try {
    const firstRelease = release('release-one', 'Existing Admin topic');
    let base = await start(firstRelease);
    let response = await request.get(`${base}/api/public`);
    let event = (await response.json()).events[0];
    expect(event.theme).toBe('Existing Admin topic');
    expect(event.speechLink).toBe('/uploads/speeches/old-upload.pdf');
    expect(await (await request.get(`${base}${event.speechLink}`)).body()).toEqual(pdf);
    response = await request.post(`${base}/api/login`, { data: { email, password } });
    expect(response.ok()).toBeTruthy();

    // A request that starts before an Admin edit but finishes afterwards must use
    // the latest database, rather than undoing that edit with an older snapshot.
    const payload = JSON.stringify({ eventId: 'event-test', name: 'New attendee', email: 'new@example.test',
      phone: '1234567890', age: '20', gender: 'Female', profile: 'Student', attendedBefore: 'No',
      receivedQuran: 'No', source: 'Friend' });
    pending = http.request(`${base}/api/registrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    });
    const completed = new Promise((resolve, reject) => {
      pending.once('response', (res) => { res.resume(); res.once('end', () => resolve(res.statusCode)); });
      pending.once('error', reject);
    });
    pending.write(payload.slice(0, 1));
    response = await request.put(`${base}/api/admin/events`, { data: { id: 'event-test',
      theme: 'Trials That Define US', speechLink: `data:application/pdf;base64,${pdf.toString('base64')}` } });
    expect(response.ok()).toBeTruthy();
    pending.end(payload.slice(1));
    expect(await completed).toBe(201);
    event = (await (await request.get(`${base}/api/public`)).json()).events[0];
    const uploadedUrl = event.speechLink;
    expect(event.theme).toBe('Trials That Define US');
    expect(uploadedUrl).toMatch(/^\/uploads\/speeches\//);
    expect(await (await request.get(`${base}${uploadedUrl}`)).body()).toEqual(pdf);
    const saved = JSON.parse(fs.readFileSync(path.join(storage, 'suhbah-db.json'), 'utf8'));
    expect(saved.registrations).toHaveLength(2);
    expect(saved.registrations[0].eventTheme).toBe('Trials That Define US');
    expect((await request.get(`${base}/data/suhbah-db.json`)).status()).toBe(404);
    expect((await request.get(`${base}/uploads/speeches/%2e%2e%2fsuhbah-db.json`)).status()).toBe(404);

    await stop();
    // A separate checkout represents a deployment with outdated bundled data.
    // Its files must not overwrite the data saved on the persistent volume.
    const secondRelease = release('release-two', 'Outdated repository topic');
    base = await start(secondRelease);
    event = (await (await request.get(`${base}/api/public`)).json()).events[0];
    expect(event.theme).toBe('Trials That Define US');
    expect(event.speechLink).toBe(uploadedUrl);
    expect(await (await request.get(`${base}${uploadedUrl}`)).body()).toEqual(pdf);
    expect(await (await request.get(`${base}/uploads/speeches/old-upload.pdf`)).body()).toEqual(pdf);
    expect(JSON.parse(fs.readFileSync(path.join(storage, 'suhbah-db.json'), 'utf8')).registrations).toHaveLength(2);
    expect(JSON.parse(fs.readFileSync(path.join(secondRelease, 'data', 'suhbah-db.json'), 'utf8')).events[0].theme)
      .toBe('Outdated repository topic');
  } finally {
    pending?.destroy();
    await stop();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
