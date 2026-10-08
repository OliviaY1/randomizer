"""Deploy the workflow commit to Render; success means that commit is live."""

import json
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def api_request(path, token, payload=None):
    request = Request(
        f"https://api.render.com/v1/{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    # Do not retry POST: a lost response could otherwise create a duplicate deploy.
    attempts = 1 if payload is not None else 3
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            if attempt + 1 < attempts and (error.code == 429 or error.code >= 500):
                time.sleep(5)
                continue
            # Do not print request headers, credentials, or raw provider responses.
            raise RuntimeError(f"Render API returned HTTP {error.code}.") from None
        except (URLError, TimeoutError):
            if attempt + 1 < attempts:
                time.sleep(5)
                continue
            raise RuntimeError("Could not reach the Render API.") from None


def deploy(service_id, token, commit_sha, *, request=api_request, sleep=time.sleep, max_polls=80):
    if not re.fullmatch(r"srv-[A-Za-z0-9]+", service_id):
        raise ValueError("RENDER_SERVICE_ID must be the existing srv-... service ID.")
    if not re.fullmatch(r"[a-f0-9]{40}", commit_sha):
        raise ValueError("GITHUB_SHA must be a full Git commit SHA.")
    path = f"services/{service_id}/deploys"
    created = request(path, token, {"commitId": commit_sha, "clearCache": "do_not_clear"})
    deploy_id = created.get("id", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", deploy_id):
        raise RuntimeError("Render did not return a valid deployment ID.")
    print(f"Waiting for Render deployment {deploy_id} of commit {commit_sha}.", flush=True)
    failures = {"build_failed", "pre_deploy_failed", "update_failed", "canceled", "deactivated"}
    for _ in range(max_polls):
        details = request(f"{path}/{deploy_id}", token)
        status = details.get("status")
        print(f"Render status: {status}", flush=True)
        if status == "live":
            if details.get("commit", {}).get("id") != commit_sha:
                raise RuntimeError("Render reports a different live commit than the workflow requested.")
            return deploy_id
        if status in failures:
            raise RuntimeError(f"Render deployment ended with status {status}.")
        sleep(15)
    raise RuntimeError("Timed out waiting for Render to report the requested commit as live.")


def main():
    required = ("RENDER_SERVICE_ID", "RENDER_API_KEY", "GITHUB_SHA")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise ValueError("Missing configuration: " + ", ".join(missing))
    deploy_id = deploy(*(os.environ[name] for name in required))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write(f"### Render deployment\nDeployment `{deploy_id}` is live.\n")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as error:
        print(f"::error::{error}", file=sys.stderr)
        sys.exit(1)
