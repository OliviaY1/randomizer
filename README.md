# Classroom Presentation Randomizer

An instructor's command center for in-person presentation sessions.

- Randomly draws the next team, without repeats
- Shows the current team's name, project, and members
- Add or remove teams at any time (members are optional)
- Presentation timer (default 7 min) with a 2-minute warning, then a separate
  Q&A countdown (default 3 min). Both lengths can be changed in the app
- Drag the timer bar to add or remove time
- Optional chime at the 2-minute warning and when time is up

## Architecture

- `backend/`: FastAPI REST API. Owns the team list and which teams have presented.
- `frontend/`: React (Vite) single-page app. Owns the UI and the timer.

The two only talk over HTTP (`/api/...`), so each can be deployed separately.

## Run locally

Requires Python 3.10+ and Node.js 20.19+ (or 22.12+).

Backend (terminal 1):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend (terminal 2):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

## Configuration

Teams and timer settings can be changed in the app, and changes are saved to
`backend/session.json`. You can also edit that file directly (for example, to
change the session `title` or `warningMinutes`). Restart the backend after
editing it by hand.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | frontend `.env` | Backend URL (default `http://localhost:8000`) |
| `ALLOWED_ORIGINS` | backend env | Comma-separated frontend URLs allowed to call the API (default `http://localhost:5173`) |

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/session` | Settings, teams, presented order, current team |
| PUT | `/api/settings` | Change `presentationMinutes`, `qaMinutes` (1 to 60) and `chime` |
| POST | `/api/teams` | Add a team (`name`, optional `project` and `members`) |
| DELETE | `/api/teams/{id}` | Remove a team, including one that has presented |
| POST | `/api/next` | Randomly draw a team that hasn't presented yet |
| POST | `/api/reset` | Clear the presented list |

Interactive docs: http://localhost:8000/docs

## Moving to the cloud

- Frontend: set `VITE_API_URL` to the deployed backend URL.
- Backend: set `ALLOWED_ORIGINS` to the deployed frontend URL.
- Teams are saved to a JSON file and the presented list is kept in memory
  (`backend/store.py`). Cloud servers don't keep local files, so replace
  `SessionStore` with a database-backed version with the same methods;
  `main.py` doesn't need to change.
