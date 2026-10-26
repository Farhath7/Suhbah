const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Pool } = require('pg');

const root = path.resolve(__dirname, '..');
process.loadEnvFile(path.join(root, '.env'));

test('shared database preserves concurrent registrations, sessions, edits and PDFs across processes', { timeout: 90000 }, async () => {
  const schema = `suhbah_test_${Date.now()}`;
  process.env.SUHBAH_DB_SCHEMA = schema;
  const { createStore, storageConfig, BUCKET } = require('../storage');
  const url = new URL(process.env.POSTGRES_URL);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new Pool({ connectionString: url.href, max: 1, ssl: {
    rejectUnauthorized: true, ca: fs.readFileSync(path.join(root, 'certs', 'supabase-ca.crt'), 'utf8'),
  } });
  const fixture = {
    adminUsers: [{ id: 'admin-1', name: 'Test Admin', email: 'admin@example.test', passwordHash: crypto.createHash('sha256').update('test-password').digest('hex') }],
    events: [{ id: 'event-test', number: 'Test event', theme: 'Persistence test', status: 'upcoming', registrationStatus: 'Open' }],
    registrations: [], testimonials: [], communityStats: {}, socialLinks: {},
  };
  const children = [];
  let pdfName;
  const store = createStore({ filePath: 'unused' });
  async function start(port) {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env,
      PORT: String(port), ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: 'test-password', GMAIL_APP_PASSWORD: '', GMAIL_USER: '',
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server start timed out')), 10000);
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited')); });
      child.stdout.on('data', (chunk) => { if (String(chunk).includes('Suhbah running')) { clearTimeout(timer); resolve(); } });
    });
    return `http://127.0.0.1:${port}`;
  }
  async function request(base, route, method = 'GET', body, cookie) {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { response, data };
  }
  try {
    await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.app_state (id integer PRIMARY KEY, document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    await pool.query(`INSERT INTO ${schema}.app_state VALUES (1, $1, now())`, [JSON.stringify(fixture)]);
    const first = await start(4817);
    const second = await start(4818);
    const login = await request(first, '/api/login', 'POST', { email: 'admin@example.test', password: 'test-password' });
    assert.equal(login.response.status, 200);
    const cookie = login.response.headers.get('set-cookie').split(';')[0];
    assert.equal((await request(second, '/api/admin', 'GET', null, cookie)).response.status, 200);
    const registrations = await Promise.all(Array.from({ length: 12 }, (_, i) => request(i % 2 ? first : second, '/api/registrations', 'POST', {
      eventId: 'event-test', name: `Persistence Test ${i}`, email: `test${i}@example.test`, phone: '0000000000', age: '20', gender: 'Female',
      profile: 'Student', attendedBefore: 'No', receivedQuran: 'No', source: 'Test',
    })));
    assert(registrations.every((r) => r.response.status === 201));
    const dashboard = await request(second, '/api/admin', 'GET', null, cookie);
    assert.equal(dashboard.data.registrations.length, 12);
    assert(!('sessions' in dashboard.data));
    assert(!('adminUsers' in dashboard.data));
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const edit = await request(first, '/api/admin/events', 'PUT', { id: 'event-test', speechLink: `data:application/pdf;base64,${pdf.toString('base64')}` }, cookie);
    assert.equal(edit.response.status, 200);
    const pdfLink = edit.data.events[0].speechLink;
    pdfName = path.basename(pdfLink);
    assert(pdfLink.startsWith('/uploads/speeches/'));
    const downloaded = await request(second, pdfLink);
    assert.equal(downloaded.response.status, 200);
    assert.deepEqual(downloaded.data, pdf);
    await request(second, '/api/admin/events', 'PUT', { id: 'event-test', theme: 'Persisted edit' }, cookie);
    const publicData = await request(first, '/api/public');
    assert.equal(publicData.data.events[0].theme, 'Persisted edit');
    assert.equal(publicData.data.events[0].speechLink, pdfLink);
    assert(!('registrations' in publicData.data));
    assert.equal((await request(first, '/api/admin')).response.status, 401);
    await assert.rejects(store.withDb((db) => { db.events = []; throw new Error('Test rollback'); }), /Test rollback/);
    assert.equal(await store.withDb((db) => db.events.length, { write: false }), 1);
    await request(second, '/api/logout', 'POST', {}, cookie);
    assert.equal((await request(first, '/api/admin', 'GET', null, cookie)).response.status, 401);
    // A fresh server process must read the same committed state.
    children[0].kill();
    await new Promise((resolve) => children[0].once('exit', resolve));
    const restarted = await start(4817);
    assert.equal((await request(restarted, '/api/public')).data.events[0].theme, 'Persisted edit');
  } finally {
    for (const child of children) if (child.exitCode === null && !child.killed) child.kill();
    await store.close();
    if (pdfName) {
      const config = storageConfig();
      const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}`, { method: 'DELETE',
        headers: { ...config.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [pdfName] }) });
      assert(response.ok, 'Could not clean up the isolated test PDF');
    }
    // Only this test's newly created schema is removed.
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
    delete process.env.SUHBAH_DB_SCHEMA;
  }
});
