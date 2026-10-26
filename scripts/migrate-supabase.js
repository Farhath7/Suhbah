const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const { uploadPdf, storageConfig, BUCKET } = require('../storage');

async function main() {
  const source = process.argv[2] || path.join(root, 'data', 'suhbah-db.json');
  const db = JSON.parse(fs.readFileSync(source, 'utf8'));
  const backup = path.join(root, '.local-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backup, { recursive: true });
  fs.writeFileSync(path.join(backup, 'original-db.json'), JSON.stringify(db, null, 2), { mode: 0o600 });
  const live = await fetch('https://suhbah-connect.vercel.app/api/public');
  if (!live.ok) throw new Error('Could not back up the current live content; migration stopped');
  const publicData = await live.json();
  fs.writeFileSync(path.join(backup, 'live-public.json'), JSON.stringify(publicData, null, 2), { mode: 0o600 });
  for (const key of ['events', 'testimonials', 'communityStats', 'socialLinks']) {
    if (!publicData[key]) throw new Error(`Live backup is missing ${key}`);
    db[key] = publicData[key];
  }
  delete db.sessions;
  const config = storageConfig();
  if (!config) throw new Error('Supabase server credentials are missing');
  const bucket = await fetch(`${config.url}/storage/v1/bucket`, {
    method: 'POST', headers: { ...config.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, allowed_mime_types: ['application/pdf'], file_size_limit: 3000000 }),
  });
  if (!bucket.ok) {
    const existing = await fetch(`${config.url}/storage/v1/bucket/${BUCKET}`, { headers: config.headers });
    if (!existing.ok || (await existing.json()).public) throw new Error('Could not create or verify the private PDF bucket');
  }
  for (const event of db.events) {
    let bytes;
    const link = event.speechLink || '';
    if (link.startsWith('data:application/pdf;base64,')) bytes = Buffer.from(link.split(',', 2)[1], 'base64');
    else if (link.startsWith('/assets/speeches/') || link.startsWith('/uploads/speeches/')) {
      const local = path.join(path.dirname(path.dirname(source)), 'assets', 'speeches', path.basename(link));
      if (fs.existsSync(local)) bytes = fs.readFileSync(local);
      else {
        const response = await fetch(`https://suhbah-connect.vercel.app${link}`);
        if (!response.ok) throw new Error('An existing PDF could not be backed up');
        bytes = Buffer.from(await response.arrayBuffer());
      }
    }
    if (bytes) {
      const name = `speech-${crypto.createHash('sha256').update(bytes).digest('hex')}.pdf`;
      fs.writeFileSync(path.join(backup, name), bytes);
      event.speechLink = await uploadPdf(bytes, name);
    }
  }
  const url = new URL(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new Pool({ connectionString: url.href, max: 1, ssl: { rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(root, 'certs', 'supabase-ca.crt'), 'utf8') }, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS suhbah_private;
      REVOKE ALL ON SCHEMA suhbah_private FROM PUBLIC, anon, authenticated;
      CREATE TABLE IF NOT EXISTS suhbah_private.app_state (
        id integer PRIMARY KEY CHECK (id = 1), document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE suhbah_private.app_state ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON suhbah_private.app_state FROM PUBLIC, anon, authenticated;
    `);
    const result = await client.query('INSERT INTO suhbah_private.app_state (id, document) VALUES (1, $1) ON CONFLICT (id) DO NOTHING RETURNING id', [JSON.stringify(db)]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ inserted: result.rowCount === 1, events: db.events.length,
      registrations: db.registrations.length, backupDirectory: backup }));
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally {
    client.release(); await pool.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
