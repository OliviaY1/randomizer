# Architecture decisions and questions for the team

Prepared with [Issue #6](https://github.com/OliviaY1/randomizer/issues/6) for teammate review. This explains the current implementation and proposed deployment process. The rationale is an analysis of technical trade-offs, not a claim about undocumented historical discussions. Questions requiring the original team context are explicitly listed below.

## Current system and technical rationale

### React/Vite frontend and FastAPI backend

The browser owns timers, random selection, team editing and local setup. The API validates and saves the authenticated user's setup. Keeping countdowns and random draws in the browser avoids a request for each interaction and lets the core classroom flow operate without signing in. The HTTP boundary allows independent deployment.

Separate services require correct API URLs, CORS, compatible payloads and a consistent authentication contract. Browser state is not automatically shared across devices. Evidence: `frontend/src/setup.js`, `frontend/src/useDualTimer.js`, `frontend/src/useSetupStore.js`, `backend/main.py`.

### Vercel frontend and Render API

The public frontend is on Vercel and its published configuration points to Render. Retaining those hosts for Actions uses the deployment setup already in place and focuses this change on delivery. A static Vite build and independently hosted Python API fit the existing separation.

This introduces two deployment histories and environment configurations. The workflow builds the frontend first, deploys/checks the API, then publishes the frontend. It cannot guarantee atomic rollback across hosts. Actual pricing, selected plans, sleep behavior, uptime guarantees and comparative provider evaluations are not established by the repo and need team input.

### Browser-local persistence plus account saving

Signed-out users can use the randomizer without an account; their setup survives reloads in that browser. Signed-in users have a setup stored under their account through the backend. This supports both a quick classroom session and reuse from another device.

Local data can be lost if browser storage is cleared. Signing in can replace anonymous edits with the saved account setup, displaying a notice. This product trade-off needs checking against the team's CUJs. Saves replace a single setup; simultaneous edits have no conflict resolution. Evidence: `frontend/src/localStore.js`, `frontend/src/useSetupStore.js`.

### PostgreSQL in production and SQLite for development

The backend chooses its store through `DATABASE_URL`. Hosted PostgreSQL separates saved setups from the API process's local filesystem; SQLite lets developers run without provisioning a database server. Both implement the same get/put interface. CI exercises both using disposable test data.

The schema stores one setup per user as a JSON document. This matches the current save/load operation without tables and joins for every UI detail, but limits cross-setup querying and does not provide versioned history. The database provider, tier, backup policy and tested recovery procedure need confirmation. Evidence: `backend/storage.py`, `backend/tests/test_storage.py`.

### Microsoft sign-in and per-user data

The implementation delegates sign-in to Microsoft and associates setups with tenant/user identifiers rather than changeable email addresses. This avoids maintaining application passwords and gives the API a basis for separating users' saved setups. The configured authority supports multiple Microsoft account types, subject to the actual registration and tenant policies.

This does not establish that authentication is production-ready. The API currently accepts ID tokens; Microsoft's guidance recommends API access tokens for authorization. Deployment work does not change that design. Account eligibility and real sign-in behavior still need verification. Evidence: `frontend/src/auth.js`, `backend/ms_auth.py`, `backend/main.py`; [Microsoft token guidance](https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens).

### GitHub Actions after a reviewed merge

The proposed workflow checks PRs and deploys a tested main commit after merge. This puts delivery evidence alongside the reviewed change and meets A3's explicit workflow-file requirement once merged. A tag/release trigger is also valid; merge-to-main is a lean choice for frequent updates. The separate team repo still owns the graded A3 Release snapshot.

Provider credentials come from GitHub Secrets; runtime configuration stays with the hosts. Provider completion and HTTP checks provide stronger evidence than merely accepting a deployment trigger. One-time configuration and browser verification remain necessary before claiming a successful production deployment. See [deployment instructions](deployment.md).

## MVP scope and possible future work

The current scope is a single instructor managing a presentation session, with one saved setup per account. It does not require shared editing, multiple regions, a service mesh or a distributed timer for that flow. These are scope observations, not evidence that the team evaluated every alternative.

Possible next steps include multiple named sessions, save history/conflict detection, stronger API authorization, tested backups/recovery, monitoring, and API/database scaling based on measured load. These are options for discussion, not approved roadmap commitments. Primary-use-case changes require instructor approval under the supplied course rules.

## Questions to forward to our teammate

1. **Why did we originally choose Vercel and Render?** Existing experience, setup speed, cost, course guidance, or a specific feature? Which alternatives did we actually consider, if any?
2. **What are our actual hosting/database plans?** Which provider hosts PostgreSQL? Do the plans sleep, expire or have limits affecting classroom use? Who owns the services?
3. **What caused us to add browser-local and account saving?** Please supply the exact A2 peer/instructor feedback or CUJ observation, with its date/source. Were these features planned already?
4. **Why Microsoft sign-in?** Are intended users UofT instructors, other school/work accounts, personal accounts, or all of these? Has real sign-in been tested for those groups?
5. **Is replacing anonymous edits on sign-in intentional?** Does the notice meet the user need, or should users be offered a choice? Was this reviewed in a CUJ?
6. **Did our primary use cases change between A2 and A3?** What changed, and where is instructor approval recorded, if applicable?
7. **Which production journeys have actually been tested?** Record sign-in, save/reload, another-device loading, account separation and persistence after redeployment, including dates/results.
8. **Which changes respond to feedback?** For each, identify feedback → change → evidence of improvement. This is needed before writing the approximately 500-word A3 reflection honestly.
9. **What future work has the team actually agreed to?** Distinguish agreed roadmap items from the possibilities above and identify the user/load requirement behind each.

## Where this belongs in the submission

This belongs in GitHub as reviewable engineering documentation. The Issue records the rationale for the new work; its PR records implementation and teammate review. After answering the questions, adapt the confirmed material into the no-code team repo's architecture rationale and feedback reflection. Link relevant Issues, PRs and the successful workflow run as evidence.

This draft does not replace the required cloud architecture diagram, feedback-specific reflection or A3 Release.
