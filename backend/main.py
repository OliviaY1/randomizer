import os
from contextlib import asynccontextmanager
from typing import Annotated

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env if it exists

from fastapi import Depends, FastAPI, Header, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import RedirectResponse  # noqa: E402
from pydantic import BaseModel, ConfigDict, Field  # noqa: E402

from ms_auth import AuthError, AuthUnavailable, MicrosoftTokenVerifier  # noqa: E402
from storage import open_store  # noqa: E402

CLIENT_ID = os.getenv("MSAL_CLIENT_ID", "").strip()
# Hosted Postgres in the cloud; a local SQLite file if not set
DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or "sqlite:///randomizer.db"

_store = open_store(DATABASE_URL)
_verifier = MicrosoftTokenVerifier(CLIENT_ID) if CLIENT_ID else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    _store.close()  # release database connections when the server stops


app = FastAPI(title="Presentation Randomizer API", lifespan=lifespan)

# Which frontends may call this API. Locally that's the Vite dev server.
# In the cloud, set ALLOWED_ORIGINS to your deployed frontend URL.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_store():
    return _store


def get_verifier() -> MicrosoftTokenVerifier | None:
    return _verifier


def current_user(
    authorization: Annotated[str | None, Header()] = None,
    verifier: MicrosoftTokenVerifier | None = Depends(get_verifier),
) -> str:
    """Who is calling, proven by their Microsoft sign-in. Used by every /api/me route."""
    if verifier is None:
        raise HTTPException(503, "Sign-in isn't set up on the server. Set MSAL_CLIENT_ID in backend/.env.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to save your setup.", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = verifier.verify(authorization[7:].strip())
    except AuthUnavailable:
        raise HTTPException(503, "Couldn't reach Microsoft to check your sign-in. Try again shortly.")
    except AuthError:
        raise HTTPException(
            401, "Your sign-in has expired or is invalid. Sign in again.", headers={"WWW-Authenticate": "Bearer"}
        )
    return verifier.user_key(claims)


# What a saved setup looks like. Limits keep one user from storing huge data.
Short = Annotated[str, Field(max_length=60)]


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(default="Final project presentations", max_length=80)
    presentationMinutes: int = Field(ge=1, le=60)
    qaMinutes: int = Field(ge=1, le=60)
    warningMinutes: int = Field(default=2, ge=1, le=60)
    chime: bool = True


class Team(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=60)
    project: str = Field(default="", max_length=120)
    members: list[Short] = Field(default_factory=list, max_length=50)


class Setup(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: int = 1
    settings: Settings
    teams: list[Team] = Field(default_factory=list, max_length=300)
    presentedIds: list[Annotated[str, Field(max_length=64)]] = Field(default_factory=list, max_length=300)
    currentId: str | None = Field(default=None, max_length=64)
    updatedAt: int = Field(default=0, ge=0)  # when the user last changed it (ms)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/api/health")
def health():
    return {"status": "ok", "signIn": _verifier is not None, "storage": _store.kind}


@app.get("/api/me/setup")
def get_my_setup(user: str = Depends(current_user), store=Depends(get_store)):
    """The signed-in user's saved setup, or null if they haven't saved one yet."""
    return {"setup": store.get(user)}


@app.put("/api/me/setup")
def save_my_setup(setup: Setup, user: str = Depends(current_user), store=Depends(get_store)):
    """Replace the signed-in user's saved setup."""
    store.put(user, setup.model_dump())
    return {"saved": True}
