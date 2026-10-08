# GitHub Actions deployment

Workflow: [.github/workflows/deploy.yml](../.github/workflows/deploy.yml). Tracking: [Issue #6](https://github.com/OliviaY1/randomizer/issues/6).

## Trigger and execution

1. A PR targeting `main` runs frontend lint/build, backend tests against SQLite and disposable PostgreSQL, and deployment-status tests. PRs do not run the Actions production job or use deployment secrets. The existing Vercel Git integration may independently publish a preview.
2. A push to `main`, normally from merging an approved PR, repeats validation. Successful validation allows production deployment.
3. The production job checks its five required settings and rejects an outdated main commit. It pulls the existing Vercel project's production configuration and builds the frontend before changing either live service.
4. Actions asks Render to deploy `GITHUB_SHA` and polls until that deployment is live. Failure, cancellation, a different commit or timeout fails the job. A successful trigger request alone is not success.
5. Actions checks backend health for PostgreSQL and sign-in configuration, and checks that an anonymous saved-setup request returns HTTP 401.
6. The Vercel CLI uploads the production build and waits for completion. Actions checks the public homepage and sign-in callback and records deployment links/commit information in the run summary.

`workflow_dispatch` permits manual retries on `main` after configuration changes. Selecting another branch runs validation only. Production runs are serialized; PR revisions can cancel older PR checks. Use the latest main run for retries.

The hosts do not form an atomic release: if Render succeeds and Vercel fails, the backend may be new while the frontend remains old. Keep API changes backward compatible. Fix the error and rerun the latest main workflow, or revert through a reviewed PR. This workflow does not provision infrastructure or perform database migrations.

## One-time GitHub configuration

In the **application repository**, open **Settings → Secrets and variables → Actions → New repository secret**. Add values for the existing services:

| Secret | Value to obtain |
| --- | --- |
| `VERCEL_TOKEN` | A Vercel access token permitted to deploy the existing frontend project |
| `VERCEL_ORG_ID` | The existing Vercel team/account ID (`orgId` in a linked project's `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | The existing frontend project's ID (`projectId` in that same file) |
| `RENDER_API_KEY` | A Render API key permitted to deploy the existing backend service |
| `RENDER_SERVICE_ID` | The backend web service's `srv-...` ID, not its database ID |

The IDs are identifiers rather than passwords, but the workflow reads all five consistently through GitHub Secrets. Do not paste token values into Issues, PRs, screenshots or this document. No production database URL is needed in GitHub for this workflow.

Missing configuration fails with the setting's name instead of skipping deployment and showing misleading success. Adding the file does not establish a successful cloud push until configuration and the first production run are verified.

## Confirm the existing provider settings

These are expected settings, not a claim that private provider dashboards have been inspected:

- **Vercel:** this app repo, Root Directory `frontend`, Vite build (`npm run build`, output `dist`), Node 22, and automatic assignment of production domains enabled. Actions runs Vercel commands from the repository root using the downloaded project settings. Keep `VITE_API_URL=https://randomizer-smj8.onrender.com` and the correct `VITE_MSAL_CLIENT_ID` in the **Production** build environment.
- **Render:** the existing Python web service uses this repo, Root Directory `backend`, build `pip install -r requirements.txt`, and start `uvicorn main:app --host 0.0.0.0 --port $PORT`. Keep the current PostgreSQL `DATABASE_URL`, `MSAL_CLIENT_ID` and deployed frontend `ALLOWED_ORIGINS` in Render's environment settings.
- **Microsoft registration:** allow the production SPA redirect URI `https://randomizer-weld-one.vercel.app/redirect.html`.

Existing provider Git integrations can deploy independently of Actions. To make Actions the production gate, disable Render's automatic Git deploys and Vercel's automatic Git deployment for `main` when activating this workflow; Vercel previews can remain enabled. These provider changes have not been made by this PR. Until then, merges may produce duplicate deployments and provider integrations may deploy before Actions checks finish.

## Verify it in GitHub and on the web

After configuration and teammate approval:

1. Merge the PR. Under **Actions → Validate and deploy**, open the run triggered by that merge. Both **Build, lint and test** and **Deploy production** must succeed. A green PR check with production skipped is not deployment evidence.
2. Check the run summary's commit, Render deployment ID and Vercel deployment URL. Confirm both providers show the intended deployment as live. Copy the successful Actions **run URL**.
3. Open the [public app](https://randomizer-weld-one.vercel.app). Add teams, draw without repeats, and exercise presentation/Q&A timers.
4. Test signed-out reload persistence. Sign in with a permitted Microsoft account, save a disposable setup, reload, and verify it from another browser/device signed into the same account. Check that a different account cannot see that setup.
5. Sign out and confirm the account's team list is cleared from the shared browser UI. After a later deployment, verify the saved setup still loads. Remove disposable test data when finished.

Automated HTTP checks do not prove OAuth consent, database writes, cross-device persistence or complete user journeys. PR validation tests do not modify real accounts or production data.

For failures, read the first failing step. Missing secrets require GitHub setup; provider HTTP 401/403 requires checking permissions and IDs; Render build failures require its deploy logs; incorrect storage/sign-in health requires checking runtime settings. The Render waiter allows approximately 20 minutes plus request time; the production job allows 35 minutes.

## Evidence for Assignment 3

The supplied A3 instructions require the workflow file, a successful automated cloud push, and a technical workflow explanation directly linking the file. They do **not** explicitly require a screenshot or recording of GitHub Actions. Keeping the successful run URL is recommended evidence, not an additional quoted requirement.

In the separate no-code team repo, adapt this explanation into `rapid-mvp/architecture/workflow.md`. Include:

- A direct link to this application's workflow, preferably pinned to the verified commit.
- Trigger, validation, deployment order and credential-handling explanation.
- Successful production run URL and live application URL.
- Actual manual checks performed and unresolved limitations.

Link it from the team repo's architecture README and A3 Release. The required promotional video is a separate 30–60 second user-value pitch, not an Actions tutorial. The board screenshot belongs to the postponed weekly check-in.

## Provider references

- [Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [Vercel deployment CLI](https://vercel.com/docs/cli/deploy)
- [Render deployment behavior](https://render.com/docs/deploys)
- [Render trigger-deploy API](https://api-docs.render.com/reference/create-deploy)
- [Render retrieve-deploy API](https://api-docs.render.com/reference/retrieve-deploy)
