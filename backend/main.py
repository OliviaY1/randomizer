import os
import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from store import SessionStore

app = FastAPI(title="Presentation Randomizer API")

# Which frontends may call this API. Locally that's the Vite dev server.
# In the cloud, set ALLOWED_ORIGINS to your deployed frontend URL.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

store = SessionStore()


class NewTeam(BaseModel):
    """What the frontend sends when creating a team."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    project: str = Field(default="", max_length=120)
    members: list[str] = []  # may be empty

    @field_validator("members")
    @classmethod
    def drop_blank_members(cls, members: list[str]) -> list[str]:
        return [m.strip() for m in members if m.strip()]


class TimerSettings(BaseModel):
    """Timer lengths the instructor can change, in whole minutes."""

    presentationMinutes: int = Field(ge=1, le=60)
    qaMinutes: int = Field(ge=1, le=60)
    chime: bool = True


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/session")
def get_session():
    return store.snapshot()


@app.put("/api/settings")
def update_settings(settings: TimerSettings):
    store.update_settings(settings.model_dump())
    return store.snapshot()


@app.post("/api/teams", status_code=201)
def create_team(team: NewTeam):
    if store.find_by_name(team.name):
        raise HTTPException(status_code=409, detail=f'A team named "{team.name}" already exists.')
    store.add_team(team.name, team.project, team.members)
    return store.snapshot()


@app.delete("/api/teams/{team_id}")
def delete_team(team_id: str):
    if not store.remove_team(team_id):
        raise HTTPException(status_code=404, detail="Team not found.")
    return store.snapshot()


@app.post("/api/next")
def draw_next_team():
    remaining = store.remaining_teams()
    if not remaining:
        raise HTTPException(
            status_code=409,
            detail="Every team has presented. Reset the session to start over.",
        )
    team = random.choice(remaining)
    store.mark_presenting(team["id"])
    return store.snapshot()


@app.post("/api/reset")
def reset_session():
    store.reset()
    return store.snapshot()
