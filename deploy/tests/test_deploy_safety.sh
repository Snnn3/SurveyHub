#!/usr/bin/env bash
set -euo pipefail

# Behavioral safety tests for deploy/deploy.sh and deploy/release.sh using stubbed tools.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

STUB_BIN="$TMP_DIR/bin"
STUB_LOG="$TMP_DIR/calls.log"
mkdir -p "$STUB_BIN"

cat >"$STUB_BIN/gcloud" <<'EOF'
#!/usr/bin/env bash
echo "gcloud $*" >>"$STUB_LOG"
case "$*" in
  *"artifacts docker images describe"*)
    echo "${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY:-$TEAM_PREFIX}/${IMAGE_NAME:-$TEAM_PREFIX}@sha256:$(printf 'a%.0s' {1..64})"
    ;;
  *"run jobs execute"*)
    if [[ "${STUB_FAIL_MIGRATE:-0}" == "1" ]]; then
      exit 1
    fi
    ;;
  *"run services describe"*"status.url,status.latestReadyRevisionName"*)
    printf 'https://%s.a.run.app\t%s-00001-abc\n' "${SERVICE_NAME:-$TEAM_PREFIX}" "${SERVICE_NAME:-$TEAM_PREFIX}"
    ;;
  *"run services describe"*"status.url"*)
    printf 'https://%s.a.run.app\n' "${SERVICE_NAME:-$TEAM_PREFIX}"
    ;;
esac
EOF

cat >"$STUB_BIN/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >>"$STUB_LOG"
EOF

cat >"$STUB_BIN/python3" <<'EOF'
#!/usr/bin/env bash
echo "python3 $*" >>"$STUB_LOG"
EOF

chmod +x "$STUB_BIN/gcloud" "$STUB_BIN/docker" "$STUB_BIN/python3"

# Build an isolated git checkout containing the deploy scripts so dirty-tree checks never mutate the repo.
REPO_COPY="$TMP_DIR/repo"
mkdir -p "$REPO_COPY/deploy"
cp "$DEPLOY_DIR/deploy.sh" "$DEPLOY_DIR/release.sh" "$DEPLOY_DIR/validate-resources.sh" "$DEPLOY_DIR/smoke_test.py" "$REPO_COPY/deploy/"
git -C "$REPO_COPY" init -q
git -C "$REPO_COPY" config user.email "ci@example.com"
git -C "$REPO_COPY" config user.name "CI Test"
git -C "$REPO_COPY" add deploy/
git -C "$REPO_COPY" commit -qm "test fixture"
HEAD_SHA="$(git -C "$REPO_COPY" rev-parse HEAD)"

BASE_ENV=(
  "PATH=$STUB_BIN:$PATH"
  "STUB_LOG=$STUB_LOG"
  "PROJECT_ID=cpe-se-course-2026"
  "REGION=asia-southeast1"
  "TEAM_PREFIX=team99"
)

assert_fails() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL ($label): expected failure, got success" >&2
    exit 1
  fi
}

# 1. deploy.sh rejects an IMAGE_TAG that does not match checkout HEAD before touching gcloud/docker.
: >"$STUB_LOG"
OTHER_SHA="0000000000000000000000000000000000000000"
assert_fails "mismatched IMAGE_TAG" \
  env "${BASE_ENV[@]}" IMAGE_TAG="$OTHER_SHA" bash "$REPO_COPY/deploy/deploy.sh"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (mismatched IMAGE_TAG): stubs were called" >&2; exit 1; }

# 2. deploy.sh rejects a dirty checkout even when invoked from outside REPO_ROOT.
: >"$STUB_LOG"
touch "$REPO_COPY/untracked.txt"
assert_fails "dirty checkout from /tmp" \
  env "${BASE_ENV[@]}" bash -c 'cd /tmp && bash "$1"' _ "$REPO_COPY/deploy/deploy.sh"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (dirty checkout): stubs were called" >&2; exit 1; }
rm -f "$REPO_COPY/untracked.txt"

# 3. deploy.sh, release.sh, and validate-resources.sh reject out-of-team and overlapping prefixes before touching gcloud/docker.
: >"$STUB_LOG"
assert_fails "deploy.sh prefix guard" \
  env "${BASE_ENV[@]}" ARTIFACT_REPOSITORY="other-team" bash "$REPO_COPY/deploy/deploy.sh"
assert_fails "release.sh prefix guard" \
  env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" SERVICE_NAME="other-team" bash "$REPO_COPY/deploy/release.sh"
assert_fails "deploy.sh overlapping prefix guard" \
  env "${BASE_ENV[@]}" TEAM_PREFIX="team-1" SERVICE_NAME="team-10-service" bash "$REPO_COPY/deploy/deploy.sh"
assert_fails "release.sh overlapping prefix guard" \
  env "${BASE_ENV[@]}" TEAM_PREFIX="team-1" IMAGE_TAG="$HEAD_SHA" SERVICE_NAME="team-10-service" bash "$REPO_COPY/deploy/release.sh"
assert_fails "workflow guard overlapping prefix" \
  env "${BASE_ENV[@]}" TEAM_PREFIX="team-1" ARTIFACT_REPOSITORY="team-10" bash -c 'source "$1"' _ "$REPO_COPY/deploy/validate-resources.sh"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (prefix guard): stubs were called" >&2; exit 1; }
env TEAM_PREFIX="team-1" SERVICE_NAME="team-1-api" bash -c 'source "$1"' _ "$REPO_COPY/deploy/validate-resources.sh"

# 4. release.sh aborts on migration failure before updating the Cloud Run service.
: >"$STUB_LOG"
assert_fails "failed migration stops release" \
  env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" STUB_FAIL_MIGRATE=1 bash "$REPO_COPY/deploy/release.sh"
grep -q "run jobs execute team99-migrate" "$STUB_LOG"
! grep -q "run services update" "$STUB_LOG"

# 5. release.sh happy path records revision/URL/digest and rollback skips migrations.
: >"$STUB_LOG"
GITHUB_ENV_FILE="$TMP_DIR/github.env"
: >"$GITHUB_ENV_FILE"
env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" GITHUB_ENV="$GITHUB_ENV_FILE" \
  bash "$REPO_COPY/deploy/release.sh" >/dev/null
grep -q "DEPLOYED_REVISION=team99-00001-abc" "$GITHUB_ENV_FILE"
grep -q "SERVICE_URL=https://team99.a.run.app" "$GITHUB_ENV_FILE"
grep -q "DEPLOYED_IMAGE=.*@sha256:" "$GITHUB_ENV_FILE"

: >"$STUB_LOG"
env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" ROLLBACK=true bash "$REPO_COPY/deploy/release.sh" >/dev/null
! grep -q "run jobs" "$STUB_LOG"
grep -q "run services update team99" "$STUB_LOG"

# 6. deploy.sh builds linux/amd64 from repo root and invokes release + smoke_test when run from /tmp.
: >"$STUB_LOG"
(cd /tmp && env "${BASE_ENV[@]}" bash "$REPO_COPY/deploy/deploy.sh" >/dev/null)
grep -q "docker build --platform linux/amd64" "$STUB_LOG"
grep -q "run jobs execute team99-migrate" "$STUB_LOG"
grep -q "smoke_test.py https://team99.a.run.app" "$STUB_LOG"

echo "PASS deploy safety tests"
