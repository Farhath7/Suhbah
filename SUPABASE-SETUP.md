# Persistent storage on Vercel

The server uses Supabase Postgres when `POSTGRES_URL` is configured. Production
fails closed if the database is missing; it does not fall back to a local JSON
file. Local development without that variable continues to use `data/`.

Set these server environment variables in Vercel:

- `POSTGRES_URL`: Supabase transaction-pooler connection string.
- `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`): project URL.
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`): server storage key.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: existing production admin credentials.
- Existing Gmail variables remain optional for confirmation email.

Database and service credentials must never be committed or sent to the browser.
Only the project URL is safe for public use. Supabase's public CA certificate is
bundled under `certs/`; TLS certificate and hostname verification remain enabled.

## Initial migration

Run `node scripts/migrate-supabase.js /path/to/suhbah-db.json` with the server
variables in a git-ignored `.env`. The migration saves a private local backup,
preserves registrations from the source file, and takes public content from the
current live site. Existing local or inline speech PDFs are backed up and uploaded.
The insert never replaces an existing database record. Check the selected source
file before migrating, including any registrations held on another old host.

State is in `suhbah_private.app_state`, a private schema excluded from the public
Data API. Public and authenticated browser roles have no access. The existing
document structure is preserved, with a row lock around each mutation to prevent
lost updates across Vercel instances. Responses are sent only after commit.

Admin sessions are stored in the database using hashed tokens and eight-hour
expiry; they are excluded from API responses. Existing production admin
environment variables take precedence. The known demo login is disabled when
using Postgres. Configure the admin variables if no real login exists yet.

PDFs use the private `suhbah-speeches` bucket. The server handles uploads and
serves speech downloads under `/uploads/speeches/`. Speech PDFs linked in public
events are intentionally downloadable through that route. Uploads are limited to
3 MB to fit the hosting request limit after base64 encoding. Existing external
PDF links are retained.

## Verification

`npm run test:storage` creates an isolated test schema and temporary test PDF,
then removes only those test resources. It verifies concurrent writes across two
servers, shared login and logout, private-data exclusions, PDF persistence,
partial event edits, transaction rollback, and server restarts. Test credentials
and fixture registrations never enter the production schema.

Do not seed or reset the database during redeployments. For backups, export the
state document privately and download the speech bucket contents; never commit
attendee data or password hashes. Rotate private credentials if exposed, update
Vercel's environment variables, and redeploy to apply the new values.
