"""Data layer for the presentation session.

Everything that reads or changes session data lives here, so main.py never
touches storage directly. For the cloud assignment, replace this JSON-file
version with a database-backed one that has the same methods.
"""

import json
import uuid
from pathlib import Path

DATA_FILE = Path(__file__).parent / "session.json"

DEFAULT_SETTINGS = {
    "title": "Final project presentations",
    "presentationMinutes": 7,
    "qaMinutes": 3,
    "warningMinutes": 2,
    "chime": True,
}


class SessionStore:
    def __init__(self, data_file: Path = DATA_FILE):
        self.data_file = data_file
        data = json.loads(data_file.read_text()) if data_file.exists() else {}
        # Anything missing from the file falls back to the defaults
        self.settings = {**DEFAULT_SETTINGS, **data.get("settings", {})}
        self.teams = data.get("teams", [])
        # Who has presented is kept in memory only and resets on restart
        self.presented_ids: list[str] = []  # in the order teams presented
        self.current_id: str | None = None

    def _save(self) -> None:
        """Write settings and teams back to the JSON file."""
        data = {"settings": self.settings, "teams": self.teams}
        self.data_file.write_text(json.dumps(data, indent=2) + "\n")

    # Settings

    def update_settings(self, changes: dict) -> None:
        self.settings.update(changes)
        self._save()

    # Teams

    def remaining_teams(self) -> list[dict]:
        return [t for t in self.teams if t["id"] not in self.presented_ids]

    def find_by_name(self, name: str) -> dict | None:
        return next((t for t in self.teams if t["name"].lower() == name.lower()), None)

    def add_team(self, name: str, project: str, members: list[str]) -> dict:
        team = {
            "id": uuid.uuid4().hex[:8],
            "name": name,
            "project": project,
            "members": members,
        }
        self.teams.append(team)
        self._save()
        return team

    def remove_team(self, team_id: str) -> bool:
        before = len(self.teams)
        self.teams = [t for t in self.teams if t["id"] != team_id]
        if len(self.teams) == before:
            return False
        # Also forget it in the presentation order
        self.presented_ids = [i for i in self.presented_ids if i != team_id]
        if self.current_id == team_id:
            self.current_id = None
        self._save()
        return True

    # Presentation order

    def mark_presenting(self, team_id: str) -> None:
        self.presented_ids.append(team_id)
        self.current_id = team_id

    def reset(self) -> None:
        self.presented_ids = []
        self.current_id = None

    def snapshot(self) -> dict:
        return {
            "settings": self.settings,
            "teams": self.teams,
            "presentedIds": self.presented_ids,
            "currentId": self.current_id,
        }
