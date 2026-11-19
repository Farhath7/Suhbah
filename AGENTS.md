# Project workflow

- For each completed change, run appropriate checks and commit only the relevant files locally.
- After every change, start or refresh the local preview, open the affected page in the user's browser, and show the result before reporting completion or asking for production approval. Verify the updated page is visible; providing a localhost link alone is not enough. If browser access is blocked, explain the blocker and provide the local preview link and a screenshot when available.
- Before pushing to `main` or taking any other action that deploys to production, show the user the completed change and check results, then ask for explicit approval. Wait for approval for that specific production push; a general acknowledgment does not count. Do not push to production automatically.
- Production is https://suhbah-connect.vercel.app/ and deploys from `origin/main`. A push to a feature branch alone does not complete delivery.
- Prepare the change against the latest production branch, preserving unrelated production changes. Push to `main` only after the user approves that specific production push, so Vercel deploys it automatically.
- Verify the production site serves the change before reporting it as live. If deployment fails or remains pending, state that clearly.
- Commit only files relevant to the requested change. Keep local database edits, secrets, attendee information, and unrelated artifacts out of the commit.
