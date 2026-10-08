# Classroom Presentation Randomizer

An instructor's command center for in-person presentation sessions.

- Randomly draws the next team, without repeats
- Shows the current team's name, project, and members
- Add or remove teams at any time (members are optional)
- Presentation timer with a 2-minute warning, then a separate
  Q&A countdown. Both durations are adjustable
- Drag the timer bar to add or remove time
- Optional chime at the 2-minute warning and when time is up

## Live application and architecture

- [Frontend](https://randomizer-weld-one.vercel.app)
- [Backend health](https://randomizer-smj8.onrender.com/api/health)
- [Backend API documentation](https://randomizer-smj8.onrender.com/docs)

- `frontend/`: React/Vite app. Owns team selection, timers and browser-local state.
- `backend/`: FastAPI API. Verifies sign-in tokens and stores one setup per user.
- Signed-out changes stay in browser `localStorage`. Signed-in setups are saved to PostgreSQL through the API, with a browser copy for recovery.
- SQLite is the development fallback when `DATABASE_URL` is unset.
- Vercel hosts the frontend; Render hosts the API.

The two only talk over HTTP (`/api/...`), so each can be deployed separately.

[Architecture decisions and teammate questions](docs/architecture-decisions.md) explain the trade-offs and identify facts that need team confirmation.

[Deployment instructions](docs/deployment.md) explain the GitHub setup, [.github/workflows/deploy.yml](.github/workflows/deploy.yml), and how to verify a production run. PRs run checks. After the one-time setup, changes merged into `main` trigger deployment.

Application code and operational documentation live here. The separate no-code team repository holds the graded architecture artifacts and A3 Release.

## Run locally

Requires **Python 3.10+** and **Node.js 22.12+**. CI uses Python 3.12 and Node 22.

Backend (terminal 1):

```bash
cd backend
python3 -m venv .venv          # make sure your python is >= 3.10
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn main:app --reload
```

Frontend (terminal 2):

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:5173`. Clear both client-ID settings to work without sign-in. For sign-in, the Microsoft registration must allow this origin's `/redirect.html` as an SPA redirect URI. The example client ID is a public identifier, not a client secret; use the registration maintained by your team.

## Configuration

Teams, settings and presentation order can be changed in the app. They are saved in this browser when signed out, or through the account API when signed in.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | frontend `.env` | Backend URL (default `http://localhost:8000`) |
| `ALLOWED_ORIGINS` | backend env | Comma-separated frontend URLs allowed to call the API (default `http://localhost:5173`) |
| `VITE_MSAL_CLIENT_ID` | frontend build env | Microsoft app client ID; blank disables sign-in |
| `MSAL_CLIENT_ID` | backend env | Application audience checked by the token verifier |
| `DATABASE_URL` | backend env | PostgreSQL connection string; defaults to local `backend/randomizer.db` |

Frontend variables are embedded at build time. Runtime credentials belong in the host's environment settings, not Git. The deployment guide lists the separate credentials used by Actions.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Process/configuration status, including sign-in and storage type |
| GET | `/api/me/setup` | Retrieve the authenticated user's setup, or `null` |
| PUT | `/api/me/setup` | Validate and replace the authenticated user's setup |

Interactive docs: http://localhost:8000/docs

Both saved-setup methods require a Bearer token. Health does not prove a fresh database read/write succeeds; sign-in and saving still need an end-to-end browser check.

## Validation and contributions

```bash
# In frontend/
npm run lint
npm run build

# In backend/ with the virtual environment active
python -m pytest -q -rs

# From the repository root
python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
```

Local backend tests skip PostgreSQL unless `TEST_DATABASE_URL` points to a disposable test database. Never point it at production: these tests write and delete test data. CI supplies a temporary PostgreSQL service and runs those cases too.

For new work, open an Issue explaining the problem and rationale, link a feature-branch PR, and obtain a teammate's approval with substantive review comments before merging. Documentation follows the same process. [Issue #6](https://github.com/OliviaY1/randomizer/issues/6) tracks the deployment and decision-documentation work.
