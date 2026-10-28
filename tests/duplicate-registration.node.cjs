const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

test('email registrations are unique per Suhbah, including concurrent submissions', { timeout: 20000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'suhbah-duplicates-'));
  const database = path.join(workspace, 'data', 'suhbah-db.json');
  let server;
  try {
    // Run without repository data, credentials, or a connection to production.
    for (const file of ['server.js', 'storage.js', 'registration-email.js']) {
      fs.copyFileSync(path.join(root, file), path.join(workspace, file));
    }
    fs.mkdirSync(path.dirname(database));
    fs.writeFileSync(database, JSON.stringify({
      adminUsers: [],
      events: ['Open', 'Waitlist'].map((status) => ({ id: status, number: status,
        theme: 'Test gathering', status: 'upcoming', registrationStatus: status })),
      registrations: [{ id: 'existing', eventId: 'Open', email: ' Legacy@Example.test ' }],
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
    const submit = (email, eventId = 'Open') => fetch(`${base}/api/registrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, email, name: 'Test attendee', phone: '0000000000',
        age: '20', gender: 'Female', profile: 'Student', attendedBefore: 'No',
        receivedQuran: 'Not applicable', source: 'Test' }),
    });
    const saved = () => JSON.parse(fs.readFileSync(database, 'utf8')).registrations;
    const legacy = await submit('legacy@example.test');
    assert.equal(legacy.status, 409);
    assert.deepEqual(await legacy.json(), { error: "You're already registered for this Suhbah." });
    assert.equal(saved().length, 1);

    for (const status of ['Open', 'Waitlist']) {
      assert.equal((await submit(' First@Example.test ', status)).status, 201);
      for (const email of ['First@Example.test', 'first@example.test', ' FIRST@EXAMPLE.TEST ']) {
        assert.equal((await submit(email, status)).status, 409);
      }
    }
    assert.equal(saved().length, 3);
    const simultaneous = await Promise.all(['race@example.test', 'RACE@example.test', ' race@example.test ']
      .map((email) => submit(email)));
    assert.deepEqual(simultaneous.map((response) => response.status).sort(), [201, 409, 409]);
    assert.equal(saved().length, 4);
    assert.equal(saved().filter((registration) => registration.email.trim().toLowerCase() === 'race@example.test').length, 1);
    assert.equal((await submit('different@example.test')).status, 201);
    assert.equal((await submit('invalid-email')).status, 400);
    assert.equal(saved().length, 5);
  } finally {
    if (server && server.exitCode === null) {
      await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
    }
    // workspace is created by mkdtemp above, outside the user's project data.
    assert.ok(path.resolve(workspace).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
