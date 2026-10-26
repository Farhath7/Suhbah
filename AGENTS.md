# Project workflow

- For each completed change, run appropriate checks, commit the relevant files, and push to GitHub as part of the task.
- Production is https://suhbah-connect.vercel.app/ and deploys from `origin/main`. A push to a feature branch alone does not complete delivery.
- Apply the change to the latest production branch, preserving unrelated production changes, and push to `main` so Vercel deploys it automatically.
- Verify the production site serves the change before reporting it as live. If deployment fails or remains pending, state that clearly.
- Commit only files relevant to the requested change. Keep local database edits, secrets, attendee information, and unrelated artifacts out of the commit.
