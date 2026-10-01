"""Saved setups, one per signed-in user.

Where they're stored depends on DATABASE_URL:

  postgresql://user:password@host:5432/dbname   a hosted Postgres database (for the cloud)
  sqlite:///randomizer.db                       a local file (for development, the default)

Both stores have the same two methods, so the rest of the backend doesn't care which one it gets.
"""

import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path

BACKEND_DIR = Path(__file__).parent


def open_store(database_url: str):
    """Pick the store that matches the URL."""
    if database_url.startswith(("postgresql://", "postgres://")):
        return PostgresSetupStore(database_url)
    if database_url.startswith("sqlite:///"):
        path = Path(database_url.removeprefix("sqlite:///"))
        return SQLiteSetupStore(path if path.is_absolute() else BACKEND_DIR / path)
    raise ValueError("DATABASE_URL must start with postgresql:// or sqlite:///")


class PostgresSetupStore:
    """A hosted Postgres database. Data survives server restarts and redeploys."""

    kind = "postgres"

    def __init__(self, url: str):
        # Imported here so local SQLite development doesn't need the Postgres driver
        from psycopg_pool import ConnectionPool

        # A small pool reuses connections instead of opening one per request.
        # `check` replaces connections the host closed while idle.
        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=5,
            check=ConnectionPool.check_connection,
            open=True,
        )
        with self.pool.connection() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS setups ("
                " user_id TEXT PRIMARY KEY,"
                " data JSONB NOT NULL,"
                " updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"
            )

    def get(self, user_id: str) -> dict | None:
        with self.pool.connection() as conn:
            row = conn.execute("SELECT data FROM setups WHERE user_id = %s", (user_id,)).fetchone()
        return row[0] if row else None  # JSONB comes back as a dict

    def put(self, user_id: str, data: dict) -> None:
        from psycopg.types.json import Jsonb

        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO setups (user_id, data, updated_at) VALUES (%s, %s, now()) "
                "ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
                (user_id, Jsonb(data)),
            )

    def close(self) -> None:
        self.pool.close()


class SQLiteSetupStore:
    """A local file. Handy for development; most cloud hosts wipe it on restart."""

    kind = "sqlite"

    def __init__(self, path: Path):
        self.path = str(path)
        with self._connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS setups ("
                " user_id TEXT PRIMARY KEY,"
                " data TEXT NOT NULL,"
                " updated_at REAL NOT NULL)"
            )

    def _connect(self):
        # A short-lived connection per call keeps this safe across server threads
        return _SQLiteConnection(self.path)

    def get(self, user_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute("SELECT data FROM setups WHERE user_id = ?", (user_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, user_id: str, data: dict) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO setups (user_id, data, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
                (user_id, json.dumps(data), time.time()),
            )

    def close(self) -> None:
        pass  # nothing stays open


class _SQLiteConnection:
    """Opens a connection, commits on success, and always closes it."""

    def __init__(self, path: str):
        self.conn = sqlite3.connect(path)

    def __enter__(self):
        return self.conn

    def __exit__(self, exc_type, *_):
        with closing(self.conn):
            if exc_type is None:
                self.conn.commit()
