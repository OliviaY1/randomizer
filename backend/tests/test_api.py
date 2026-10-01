"""API tests. Real Microsoft tokens aren't available in tests, so we sign
tokens with our own key and give the verifier that key instead."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

import main
from ms_auth import MicrosoftTokenVerifier
from storage import SQLiteSetupStore

CLIENT_ID = "test-client-id"
UOFT_TENANT = "11111111-1111-1111-1111-111111111111"
PERSONAL_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"

PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeKeys:
    """Stands in for Microsoft's key endpoint."""

    def get_signing_key_from_jwt(self, token):
        return type("Key", (), {"key": PRIVATE_KEY.public_key()})()


def make_token(tid=UOFT_TENANT, oid="user-1", aud=CLIENT_ID, iss=None, expires_in=3600, key=PRIVATE_KEY):
    now = int(time.time())
    claims = {
        "aud": aud,
        "iss": iss or f"https://login.microsoftonline.com/{tid}/v2.0",
        "tid": tid,
        "oid": oid,
        "sub": f"sub-{oid}",
        "iat": now,
        "exp": now + expires_in,
        "name": "Test User",
    }
    return jwt.encode(claims, key, algorithm="RS256")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


SETUP = {
    "version": 1,
    "settings": {"title": "Final project presentations", "presentationMinutes": 7, "qaMinutes": 3, "warningMinutes": 2, "chime": True},
    "teams": [{"id": "a1", "name": "Byte Club", "project": "Study rooms", "members": ["Ana", "Bo"]}],
    "presentedIds": ["a1"],
    "currentId": "a1",
    "updatedAt": 1700000000000,
}


@pytest.fixture
def client(tmp_path):
    store = SQLiteSetupStore(tmp_path / "test.db")
    main.app.dependency_overrides[main.get_store] = lambda: store
    main.app.dependency_overrides[main.get_verifier] = lambda: MicrosoftTokenVerifier(CLIENT_ID, jwks_client=FakeKeys())
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_requires_sign_in(client):
    assert client.get("/api/me/setup").status_code == 401
    assert client.put("/api/me/setup", json=SETUP).status_code == 401


def test_new_user_has_no_saved_setup(client):
    response = client.get("/api/me/setup", headers=auth(make_token()))
    assert response.status_code == 200
    assert response.json() == {"setup": None}


def test_save_and_load(client):
    token = make_token()
    assert client.put("/api/me/setup", json=SETUP, headers=auth(token)).status_code == 200
    assert client.get("/api/me/setup", headers=auth(token)).json()["setup"] == SETUP


def test_users_only_see_their_own_setup(client):
    client.put("/api/me/setup", json=SETUP, headers=auth(make_token(oid="prof-a")))
    other = client.get("/api/me/setup", headers=auth(make_token(oid="prof-b")))
    assert other.json() == {"setup": None}


def test_personal_microsoft_accounts_work(client):
    token = make_token(tid=PERSONAL_TENANT, oid="personal-user")
    assert client.put("/api/me/setup", json=SETUP, headers=auth(token)).status_code == 200


@pytest.mark.parametrize(
    "token",
    [
        make_token(expires_in=-600),  # expired
        make_token(aud="some-other-app"),  # issued for another app
        make_token(iss="https://evil.example.com/v2.0"),  # wrong issuer
        make_token(key=rsa.generate_private_key(public_exponent=65537, key_size=2048)),  # not signed by Microsoft
        "not-a-token",
    ],
    ids=["expired", "wrong-audience", "wrong-issuer", "forged", "garbage"],
)
def test_rejects_bad_tokens(client, token):
    assert client.get("/api/me/setup", headers=auth(token)).status_code == 401


def test_rejects_invalid_setup(client):
    bad = {**SETUP, "settings": {**SETUP["settings"], "presentationMinutes": 0}}
    assert client.put("/api/me/setup", json=bad, headers=auth(make_token())).status_code == 422


def test_sign_in_not_configured(tmp_path):
    main.app.dependency_overrides[main.get_verifier] = lambda: None
    try:
        response = TestClient(main.app).get("/api/me/setup", headers=auth(make_token()))
        assert response.status_code == 503
    finally:
        main.app.dependency_overrides.clear()
