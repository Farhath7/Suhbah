# Persistent data on Render

Admin edits, registrations, and uploaded speech PDFs must live on a persistent
disk, outside the deployed Git checkout. Setting a directory variable without
attaching a disk does not make that directory persistent.

## Configure the existing service

1. Before redeploying or attaching a disk, back up the current live
   `data/suhbah-db.json` and `assets/speeches/` from the running service. Download
   the backup somewhere private outside Render's ephemeral filesystem. Do not
   commit it: it contains attendee information and Admin password hashes.
2. Attach a persistent disk to the existing `suhbah` Render service, mounted at
   `/var/data`. Render requires a paid service for persistent disks; confirm the
   plan and cost before provisioning. Do not create a replacement service.
3. Set `SUHBAH_DATA_DIR=/var/data/suhbah` in that service's environment.
4. Before enabling writes on the new deployment, restore the backed-up database
   as `/var/data/suhbah/suhbah-db.json` and its PDFs under
   `/var/data/suhbah/uploads/speeches/`. Keep the database private. Preserve every
   record, including registrations. Ensure `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   remain configured as Render secrets.
5. Deploy the storage-support change. On startup, existing PDF links under
   `/assets/speeches/` are updated to `/uploads/speeches/` when the corresponding
   PDF exists on the disk or in the checkout.
6. Check the live topic, registration count, Admin access, and PDF downloads.
   Restart or redeploy the service once more and verify the same data is intact.

On an empty volume, the app imports the bundled database once. This bootstrap
is useful for a fresh installation; it is **not a substitute for backing up a
running service**. Once a database exists on the volume, the app never replaces
it with a newer release's bundled data.

New speech uploads are stored alongside the database. Built-in images, fonts,
and other Git-tracked assets stay in the deployed checkout. Database writes
replace the file atomically, and incoming writes read the current database only
after their request bodies have arrived.

Keep this JSON-backed service on a single instance. Multiple processes sharing
the same database file require a transactional database instead.

## Local development and regression check

Leave `SUHBAH_DATA_DIR` empty locally to continue using `./data`.

```sh
npx playwright test tests/persistent-storage.spec.js tests/admin-access.spec.js tests/registration-email.spec.js --workers=1
```

The storage regression test uses two independent checkouts and one persistent
directory. It verifies that Admin edits, old registrations, new registrations,
and PDFs survive a release with outdated bundled data. It also checks that a
slow request cannot overwrite a newer Admin edit.

Reference: [Render persistent disks](https://render.com/docs/disks).
