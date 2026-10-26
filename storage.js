const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');

function createStore({ filePath, seed, prepare = () => {} }) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const schema = process.env.SUHBAH_DB_SCHEMA || 'suhbah_private';
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
  if (process.env.VERCEL && !connectionString) throw new Error('Persistent database is not configured');
  let queue = Promise.resolve();
  let pool;
  if (connectionString) {
    const url = new URL(connectionString);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    pool = new Pool({ connectionString: url.href, ssl: { rejectUnauthorized: true,
      ca: process.env.SUPABASE_CA_CERT || fs.readFileSync(path.join(__dirname, 'certs', 'supabase-ca.crt'), 'utf8') }, max: 3,
      connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, statement_timeout: 20000 });
    attachDatabasePool(pool);
  }

  async function withDb(callback, { write = true } = {}) {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`SELECT document FROM ${schema}.app_state WHERE id = 1${write ? ' FOR UPDATE' : ''}`);
        if (!result.rows[0]) throw new Error('Database migration has not been run');
        const db = result.rows[0].document;
        if (write) prepare(db);
        const value = await callback(db);
        if (write) await client.query(`UPDATE ${schema}.app_state SET document = $1, updated_at = now() WHERE id = 1`, [JSON.stringify(db)]);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }

    // Serialize complete local mutations, including asynchronous PDF uploads.
    const operation = queue.then(async () => {
      const db = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : structuredClone(seed);
      prepare(db);
      const value = await callback(db);
      if (write || !fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const temporary = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify(db, null, 2), { mode: 0o600 });
        fs.renameSync(temporary, filePath);
      }
      return value;
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return { withDb, persistent: Boolean(pool), close: () => pool?.end() };
}

const BUCKET = 'suhbah-speeches';
function storageConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) } };
}

async function uploadPdf(bytes, name) {
  const config = storageConfig();
  if (!config) throw new Error('PDF storage is not configured');
  if (!Buffer.from(bytes).subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Please upload a valid PDF');
  const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, {
    method: 'POST', headers: { ...config.headers, 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: bytes,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok && response.status !== 409) throw new Error(`PDF upload failed (${response.status})`);
  return `/uploads/speeches/${name}`;
}

async function downloadPdf(name) {
  const config = storageConfig();
  if (!config) throw new Error('PDF storage is not configured');
  return fetch(`${config.url}/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(name)}`, {
    headers: config.headers, signal: AbortSignal.timeout(20000),
  });
}

module.exports = { createStore, uploadPdf, downloadPdf, storageConfig, BUCKET };
