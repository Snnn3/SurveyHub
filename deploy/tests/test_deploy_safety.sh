#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

STUB_BIN="$TMP_DIR/bin"
STUB_LOG="$TMP_DIR/calls.log"
mkdir -p "$STUB_BIN"

cat >"$STUB_BIN/gcloud" <<'EOF'
#!/usr/bin/env bash
printf 'gcloud %s\n' "$*" >>"$STUB_LOG"
case "$*" in
  *"artifacts docker images describe"*)
    echo "${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/${IMAGE_NAME}@sha256:$(printf 'a%.0s' {1..64})"
    ;;
  *"status.url,status.latestReadyRevisionName"*)
    printf 'https://%s.a.run.app\t%s-00001-abc\n' "$SERVICE_NAME" "$SERVICE_NAME"
    ;;
  *"run jobs describe"*|*"run services describe"*)
    if [[ "${STUB_MISSING_CLOUDSQL:-0}" == "1" ]]; then
      echo "${TEAM_PREFIX}-runner@${PROJECT_ID}.iam.gserviceaccount.com"
    elif [[ "${STUB_MISSING_RUNTIME:-0}" == "1" ]]; then
      echo "${PROJECT_ID}:${REGION}:${TEAM_PREFIX}-pg"
    else
      echo "${PROJECT_ID}:${REGION}:${TEAM_PREFIX}-pg ${TEAM_PREFIX}-runner@${PROJECT_ID}.iam.gserviceaccount.com"
    fi
    ;;
  *"run jobs execute"*)
    if [[ "${STUB_FAIL_MIGRATE:-0}" == "1" ]]; then
      exit 1
    fi
    ;;
esac
EOF

cat >"$STUB_BIN/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >>"$STUB_LOG"
EOF

cat >"$STUB_BIN/python3" <<'EOF'
#!/usr/bin/env bash
printf 'python3 %s\n' "$*" >>"$STUB_LOG"
EOF

chmod +x "$STUB_BIN/gcloud" "$STUB_BIN/docker" "$STUB_BIN/python3"

REPO_COPY="$TMP_DIR/repo"
mkdir -p "$REPO_COPY/deploy/tests"
cp "$DEPLOY_DIR/deploy.sh" "$DEPLOY_DIR/release.sh" "$DEPLOY_DIR/validate-resources.sh" "$DEPLOY_DIR/smoke_test.py" "$REPO_COPY/deploy/"
git -C "$REPO_COPY" init -b main -q
git -C "$REPO_COPY" config user.email "ci@example.com"
git -C "$REPO_COPY" config user.name "CI Test"
git -C "$REPO_COPY" add deploy/
git -C "$REPO_COPY" commit -qm "deploy test fixture"
HEAD_SHA="$(git -C "$REPO_COPY" rev-parse HEAD)"

# Keep the manual deploy entry point aligned with the Lab 5 Starter Kit layout.
grep -q '^run_cmd()' "$REPO_COPY/deploy/deploy.sh"
grep -q '^# 9\. Build & Push' "$REPO_COPY/deploy/deploy.sh"
grep -q '^# 10\. Create/Update & Execute Cloud Run Job' "$REPO_COPY/deploy/deploy.sh"
grep -q '^# 11\. Deploy Cloud Run Service' "$REPO_COPY/deploy/deploy.sh"
grep -q 'gcloud run services describe "\$SERVICE_NAME"' "$REPO_COPY/deploy/deploy.sh"
grep -q 'gcloud run jobs describe "\$MIGRATE_JOB_NAME"' "$REPO_COPY/deploy/deploy.sh"
! grep -q 's7c512824' "$REPO_COPY/deploy/deploy.sh" "$REPO_COPY/deploy/validate-resources.sh"
! grep -q 's7c512824' "$DEPLOY_DIR/../.github/workflows/deploy.yml"
grep -q 'TEAM_PREFIX=.*WIF_SERVICE_ACCOUNT' "$DEPLOY_DIR/../.github/workflows/deploy.yml"

BASE_ENV=(
  "PATH=$STUB_BIN:$PATH"
  "STUB_LOG=$STUB_LOG"
  "PROJECT_ID=cpe-se-course-2026"
  "REGION=asia-southeast1"
  "TEAM_PREFIX=s7c512824"
  "ARTIFACT_REPOSITORY=s7c512824"
  "IMAGE_NAME=s7c512824"
  "SERVICE_NAME=s7c512824"
  "MIGRATION_JOB_NAME=s7c512824-migrate"
  "DATABASE_URL_SECRET=s7c512824-database-url"
  "JWT_SECRET_NAME=s7c512824-app-secret-1"
  "WIF_SERVICE_ACCOUNT=s7c512824-deployer@cpe-se-course-2026.iam.gserviceaccount.com"
)

assert_fails() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL ($label): expected failure, got success" >&2
    exit 1
  fi
}

# Real manual deploys reject stale image tags and dirty checkouts before calling external tools.
: >"$STUB_LOG"
OTHER_SHA="0000000000000000000000000000000000000000"
assert_fails "mismatched IMAGE_TAG" \
  env "${BASE_ENV[@]}" DRY_RUN=0 IMAGE_TAG="$OTHER_SHA" bash "$REPO_COPY/deploy/deploy.sh"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (mismatched IMAGE_TAG): stubs were called" >&2; exit 1; }
touch "$REPO_COPY/untracked.txt"
assert_fails "dirty checkout" \
  env "${BASE_ENV[@]}" DRY_RUN=0 IMAGE_TAG="$HEAD_SHA" bash "$REPO_COPY/deploy/deploy.sh"
rm -f "$REPO_COPY/untracked.txt"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (dirty checkout): stubs were called" >&2; exit 1; }

# Wrong-team overrides fail before any cloud command is called.
: >"$STUB_LOG"
assert_fails "out-of-team service" \
  env "${BASE_ENV[@]}" SERVICE_NAME=other-team bash -c 'source "$1" && exit 0' _ "$REPO_COPY/deploy/validate-resources.sh"
assert_fails "service prefix boundary" \
  env "${BASE_ENV[@]}" SERVICE_NAME=s7c512824evil bash -c 'source "$1" && exit 0' _ "$REPO_COPY/deploy/validate-resources.sh"
assert_fails "WIF identity prefix mismatch" \
  env "${BASE_ENV[@]}" WIF_SERVICE_ACCOUNT=otherteam-deployer@cpe-se-course-2026.iam.gserviceaccount.com \
  bash -c 'source "$1" && exit 0' _ "$REPO_COPY/deploy/validate-resources.sh"
env "${BASE_ENV[@]}" SERVICE_NAME=s7c512824-api bash -c 'source "$1" && exit 0' _ "$REPO_COPY/deploy/validate-resources.sh"
env PROJECT_ID=cpe-se-course-2026 REGION=asia-southeast1 TEAM_PREFIX=sample-team \
  bash -c 'source "$1" && [[ "$SERVICE_NAME" == sample-team ]]' _ "$REPO_COPY/deploy/validate-resources.sh"
assert_fails "missing team prefix" env -u TEAM_PREFIX bash "$REPO_COPY/deploy/deploy.sh"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (resource guard): cloud command was called" >&2; exit 1; }

# A failed migration must stop before the live service is changed.
: >"$STUB_LOG"
assert_fails "failed migration stops release" \
  env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" STUB_FAIL_MIGRATE=1 bash "$REPO_COPY/deploy/release.sh"
grep -q "run jobs execute s7c512824-migrate" "$STUB_LOG"
! grep -q "run services update s7c512824" "$STUB_LOG"

# Missing portal Cloud SQL configuration stops before updating the migration job or service.
: >"$STUB_LOG"
assert_fails "missing Cloud SQL attachment stops release" \
  env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" STUB_MISSING_CLOUDSQL=1 bash "$REPO_COPY/deploy/release.sh"
grep -q "run jobs describe s7c512824-migrate" "$STUB_LOG"
! grep -q "run jobs update" "$STUB_LOG"
! grep -q "run services update s7c512824" "$STUB_LOG"

# A wrong runtime identity also stops before updating either resource.
: >"$STUB_LOG"
assert_fails "wrong runtime identity stops release" \
  env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" STUB_MISSING_RUNTIME=1 bash "$REPO_COPY/deploy/release.sh"
grep -q "run jobs describe s7c512824-migrate" "$STUB_LOG"
! grep -q "run jobs update" "$STUB_LOG"
! grep -q "run services update s7c512824" "$STUB_LOG"

# A release pins one digest, updates only the required secrets, and records its revision.
: >"$STUB_LOG"
GITHUB_ENV_FILE="$TMP_DIR/github.env"
: >"$GITHUB_ENV_FILE"
env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" GITHUB_ENV="$GITHUB_ENV_FILE" \
  bash "$REPO_COPY/deploy/release.sh" >/dev/null
grep -q -- "--args run,db:migrate:deploy" "$STUB_LOG"
grep -q -- "--remove-env-vars DATABASE_URL" "$STUB_LOG"
grep -q -- "DATABASE_URL=s7c512824-database-url:latest" "$STUB_LOG"
grep -q -- "JWT_SECRET=s7c512824-app-secret-1:latest" "$STUB_LOG"
grep -q -- "--remove-env-vars DATABASE_URL,JWT_SECRET" "$STUB_LOG"
grep -q -- "--port 4000" "$STUB_LOG"
grep -q "DEPLOYED_REVISION=s7c512824-00001-abc" "$GITHUB_ENV_FILE"
grep -q "SERVICE_URL=https://s7c512824.a.run.app" "$GITHUB_ENV_FILE"
grep -q "DEPLOYED_IMAGE=.*@sha256:" "$GITHUB_ENV_FILE"
MIGRATE_LINE="$(grep -n -m1 "run jobs execute" "$STUB_LOG" | cut -d: -f1)"
SERVICE_LINE="$(grep -n -m1 "run services update s7c512824" "$STUB_LOG" | cut -d: -f1)"
[[ "$MIGRATE_LINE" -lt "$SERVICE_LINE" ]]

# Rollback does not inspect or execute the migration job and only changes the service image.
: >"$STUB_LOG"
env "${BASE_ENV[@]}" IMAGE_TAG="$HEAD_SHA" ROLLBACK=true STUB_FAIL_MIGRATE=1 \
  bash "$REPO_COPY/deploy/release.sh" >/dev/null
! grep -q "run jobs" "$STUB_LOG"
grep -q "run services update s7c512824 --image .*@sha256:" "$STUB_LOG"
! grep -q -- "--update-secrets" "$STUB_LOG"
! grep -q -- "--update-env-vars" "$STUB_LOG"

# The manual entry point defaults to a dry run and never invokes cloud/Docker tools.
: >"$STUB_LOG"
DRY_RUN_OUTPUT="$(env "${BASE_ENV[@]}" bash "$REPO_COPY/deploy/deploy.sh")"
[[ ! -s "$STUB_LOG" ]] || { echo "FAIL (dry run): external command was called" >&2; exit 1; }
grep -q "\[DRY_RUN\]" <<<"$DRY_RUN_OUTPUT"
grep -q "db:migrate:deploy" <<<"$DRY_RUN_OUTPUT"
grep -q "JWT_SECRET=s7c512824-app-secret-1:latest" <<<"$DRY_RUN_OUTPUT"
grep -q -- "--port 4000" <<<"$DRY_RUN_OUTPUT"

# A real manual run from a clean main checkout orders migration before service update and smoke-checks.
: >"$STUB_LOG"
env "${BASE_ENV[@]}" DRY_RUN=0 bash "$REPO_COPY/deploy/deploy.sh" >/dev/null
MIGRATE_LINE="$(grep -n -m1 "run jobs execute" "$STUB_LOG" | cut -d: -f1)"
SERVICE_LINE="$(grep -n -m1 "run services update s7c512824" "$STUB_LOG" | cut -d: -f1)"
[[ "$MIGRATE_LINE" -lt "$SERVICE_LINE" ]]
grep -q "docker build --platform linux/amd64" "$STUB_LOG"
grep -q "run jobs update s7c512824-migrate .*--add-cloudsql-instances cpe-se-course-2026:asia-southeast1:s7c512824-pg" "$STUB_LOG"
! grep -q -- "--set-cloudsql-instances" "$STUB_LOG"
grep -q "python3 .*deploy/smoke_test.py" "$STUB_LOG"

echo "PASS deploy safety tests"
