"""Read-only public checks for a deployed SurveyHub service.

Usage: python3 deploy/smoke_test.py SERVICE_URL
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def get(base_url, path):
    request = urllib.request.Request(
        base_url + path,
        headers={"Accept": "application/json, text/html"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def retry_check(base_url, label, path, predicate):
    for attempt in range(5):
        try:
            status, body = get(base_url, path)
            if predicate(status, body):
                print("PASS " + label)
                return
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass
        if attempt < 4:
            time.sleep(3)
    raise RuntimeError("Smoke check failed: " + label)


def check(service_url):
    parsed = urllib.parse.urlparse(service_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("SERVICE_URL must be an absolute HTTP(S) URL.")
    base_url = service_url.rstrip("/")

    def healthy(status, body):
        if status != 200:
            return False
        payload = json.loads(body)
        if not isinstance(payload, dict):
            return False
        data = payload.get("data")
        if not isinstance(data, dict):
            return False
        return payload.get("success") is True and data.get("status") == "ok" and data.get("database") == "up"

    retry_check(base_url, "database health", "/api/health", healthy)
    retry_check(
        base_url,
        "UI",
        "/",
        lambda status, body: status == 200 and b"<html" in body.lower(),
    )
    retry_check(
        base_url,
        "protected API rejects unauthenticated access",
        "/api/surveys",
        lambda status, _body: status == 401,
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 deploy/smoke_test.py SERVICE_URL")
    check(sys.argv[1])
