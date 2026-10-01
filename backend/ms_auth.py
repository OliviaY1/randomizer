"""Checks that a request comes from someone signed in with Microsoft.

The frontend signs the user in with Microsoft and sends us their ID token.
We check that Microsoft signed it, that it was issued for this app, and that
it hasn't expired. Only then do we trust who the user is.
"""

import jwt
from jwt import PyJWKClient

# Microsoft's public signing keys, shared by work, school and personal accounts
JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"


class AuthError(Exception):
    """The token is missing, expired, forged, or meant for another app."""


class AuthUnavailable(Exception):
    """We couldn't reach Microsoft to fetch its signing keys."""


class MicrosoftTokenVerifier:
    def __init__(self, client_id: str, jwks_client=None):
        self.client_id = client_id
        # Keys are cached, so Microsoft is contacted rarely, not on every request
        self.jwks_client = jwks_client or PyJWKClient(JWKS_URL, cache_keys=True, lifespan=3600)

    def verify(self, token: str) -> dict:
        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=self.client_id,
                leeway=60,  # tolerate small clock differences
                options={"require": ["exp", "iat", "iss", "aud", "sub", "tid"]},
            )
        except jwt.PyJWKClientConnectionError as exc:
            raise AuthUnavailable(str(exc)) from exc
        except jwt.PyJWTError as exc:
            raise AuthError(str(exc)) from exc

        # Each Microsoft directory (UofT, personal accounts, ...) has its own issuer
        expected_issuer = f"https://login.microsoftonline.com/{claims['tid']}/v2.0"
        if claims["iss"] != expected_issuer:
            raise AuthError("Token was not issued by Microsoft sign-in.")
        return claims

    @staticmethod
    def user_key(claims: dict) -> str:
        """A stable id for the user. Not their email, since emails can change."""
        return f"{claims['tid']}:{claims.get('oid') or claims['sub']}"
