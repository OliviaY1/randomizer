"""Both stores must behave the same. SQLite always runs; Postgres runs when
TEST_DATABASE_URL points at a Postgres database you don't mind writing to."""

import os

import pytest

from storage import SQLiteSetupStore, open_store

POSTGRES_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture(params=["sqlite", "postgres"])
def store(request, tmp_path):
    if request.param == "sqlite":
        yield SQLiteSetupStore(tmp_path / "test.db")
        return
    if not POSTGRES_URL:
        pytest.skip("Set TEST_DATABASE_URL to also test Postgres")
    s = open_store(POSTGRES_URL)
    with s.pool.connection() as conn:
        conn.execute("DELETE FROM setups WHERE user_id LIKE 'test:%'")
    yield s
    s.close()


SETUP = {"settings": {"presentationMinutes": 7}, "teams": [{"id": "a", "name": "Byte Club", "members": ["Ana"]}]}


def test_missing_user_returns_none(store):
    assert store.get("test:nobody") is None


def test_put_then_get(store):
    store.put("test:u1", SETUP)
    assert store.get("test:u1") == SETUP


def test_put_replaces(store):
    store.put("test:u1", SETUP)
    store.put("test:u1", {**SETUP, "teams": []})
    assert store.get("test:u1")["teams"] == []


def test_users_are_separate(store):
    store.put("test:u1", SETUP)
    store.put("test:u2", {**SETUP, "teams": []})
    assert store.get("test:u1") == SETUP


def test_unicode_names_round_trip(store):
    data = {**SETUP, "teams": [{"id": "b", "name": "Équipe 李", "members": ["Zoë"]}]}
    store.put("test:u3", data)
    assert store.get("test:u3") == data


def test_open_store_rejects_unknown_urls():
    with pytest.raises(ValueError):
        open_store("mysql://nope")
