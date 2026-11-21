#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SurveyHub — Idempotent Google Cloud Run Deployment Script
# ==============================================================================
# Usage:
#   TEAM_PREFIX=YOUR_TEAM_PREFIX DRY_RUN=1 ./deploy/deploy.sh
#
# Environment Variables:
#   TEAM_PREFIX  Required prefix from Student Cloud Team Resources
#   PROJECT_ID   GCP Project ID (default: cpe-se-course-2026)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES  (one-time / manual first setup; safe to re-run)
#   Uses resources provisioned by the course portal:
#   9 build image    10 run migration job    11 update Cloud Run service
#   After this, routine releases are done by GitHub Actions (deploy.yml ->
#   deploy/release.sh), which only UPDATES these resources.
#
# ⭐ IMPORTANT
#   - Existing infrastructure and secrets are reused.
#   - Credentials live in Secret Manager and are never printed.
#   - Preview with DRY_RUN=1 (no gcloud or Docker calls).
#   - Offline test: deploy/tests/test_deploy_safety.sh
#
# REFERENCES
#   - gcloud run deploy : https://cloud.google.com/sdk/gcloud/reference/run/deploy
#   - Cloud Run jobs    : https://cloud.google.com/run/docs/create-jobs
#   - Cloud SQL + Run   : https://cloud.google.com/sql/docs/postgres/connect-run
#   - Secret Manager    : https://cloud.google.com/secret-manager/docs
#   - Artifact Registry : https://cloud.google.com/artifact-registry/docs/docker
#
# ⭐ CHANGE ME — groups using another tech stack must review (marked below):
#   # CHANGE ME: resource names derived from TEAM_PREFIX
#   # CHANGE ME: Cloud Run migration command (step 10)
#   # CHANGE ME: application port and required secret mappings (step 11)
# ==============================================================================

# ------------------------------------------------------------------------------
# Settings & argument parsing
# ------------------------------------------------------------------------------
DRY_RUN="${DRY_RUN:-1}"
[[ $# -eq 0 ]] || { echo "Usage: TEAM_PREFIX=YOUR_TEAM_PREFIX DRY_RUN=1 $0" >&2; exit 1; }
[[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'DRY_RUN must be 0 or 1.' >&2; exit 1; }

# Helper: prints the command (DRY_RUN=1) or prints then executes it.
# ⭐ IMPORTANT: --password=... is redacted in the log; keep this behaviour.
run_cmd() {
  # Redact password arguments before logging.
  local arg
  if [ "$DRY_RUN" = "1" ]; then
    printf '[DRY_RUN] '
  else
    printf '+ '
  fi
  for arg in "$@"; do
    case "$arg" in
      --password=*) printf '%s ' '--password=<REDACTED>' ;;
      *) printf '%q ' "$arg" ;;
    esac
  done
  printf '\n'
  if [ "$DRY_RUN" != "1" ]; then
    "$@"
  fi
}

# Shared course project: no project discovery or project IAM changes.
PROJECT_ID="${PROJECT_ID:-cpe-se-course-2026}"
REGION="${REGION:-asia-southeast1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
source "$SCRIPT_DIR/validate-resources.sh"

# CHANGE ME: use the validated resource names from Student Cloud.
REPO_NAME="$ARTIFACT_REPOSITORY"
MIGRATE_JOB_NAME="$MIGRATION_JOB_NAME"
if [ "$DRY_RUN" = "1" ]; then
  IMAGE_TAG="${IMAGE_TAG:-0000000000000000000000000000000000000000}"
else
  IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse HEAD)}"
  [[ "$(git branch --show-current)" == "main" ]] || { echo 'Deploy reviewed main only' >&2; exit 1; }
  [[ "$IMAGE_TAG" == "$(git rev-parse HEAD)" ]] || { echo 'IMAGE_TAG must match HEAD' >&2; exit 1; }
  [[ -z "$(git status --porcelain)" ]] || { echo 'Deploy requires a clean checkout.' >&2; exit 1; }
fi
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use full commit SHA' >&2; exit 1; }
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${IMAGE_TAG}"

# Secret Manager secret names (values are never stored in this repo).
SECRET_DB_URL="$DATABASE_URL_SECRET"

echo "=================================================================="
echo "SurveyHub Cloud Run Deployment"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Team    : ${TEAM_PREFIX}"
echo "Dry Run : ${DRY_RUN}"
echo "=================================================================="

# ==============================================================================
# Portal/TA pre-provisions infrastructure and public service IAM (Guide 5.3 steps 1–8, 5.4).
# These names must exist. Never create or modify project-level IAM here.
JOB_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest"
if [ "$DRY_RUN" != "1" ]; then
  gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null
fi
assert_portal_config services "$SERVICE_NAME"
assert_portal_config jobs "$MIGRATE_JOB_NAME"

# ==============================================================================
# 9. Build & Push Unified Container Image
#    Builds the root Dockerfile and tags the image with the full commit SHA.
# ==============================================================================
run_cmd gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
run_cmd docker build --platform linux/amd64 --tag "$IMAGE_URI" .
run_cmd docker push "$IMAGE_URI"
if [ "$DRY_RUN" != "1" ]; then
  IMAGE_URI="$(gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
  [[ "$IMAGE_URI" == "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}@sha256:"* ]] || { echo 'Missing image digest' >&2; exit 1; }
fi

# ==============================================================================
# 10. Create/Update & Execute Cloud Run Job for Migration
#     ⭐ IMPORTANT: if this job fails the script stops BEFORE deploying the
#        service, so a broken migration never reaches users.
#     CHANGE ME: `--command` and `--args` run SurveyHub's Prisma migration.
#     deploy.yml / release.sh later re-run this same job.
# ==============================================================================
run_cmd gcloud run jobs update "$MIGRATE_JOB_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --remove-env-vars DATABASE_URL \
  --update-secrets "$JOB_SECRETS" \
  --command "npm" \
  --args "run,db:migrate:deploy" \
  --project "$PROJECT_ID" --quiet

if ! run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
  --region "$REGION" \
  --wait \
  --project "$PROJECT_ID" --quiet; then
  printf '%s\n' "ERROR: Cloud Run migration job '${MIGRATE_JOB_NAME}' failed. Aborting service deployment." >&2
  printf '%s\n' "View job logs with:" >&2
  printf '%s\n' "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}\" --project \"${PROJECT_ID}\" --limit 50 --format=\"value(textPayload)\"" >&2
  exit 1
fi

# ==============================================================================
# 11. Deploy Cloud Run Service
#     CHANGE ME: match the port in the Dockerfile and map the app secrets.
#     The portal manages service IAM, Cloud SQL, and scaling.
# ==============================================================================
run_cmd gcloud run services update "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --remove-env-vars DATABASE_URL,JWT_SECRET \
  --update-secrets "DATABASE_URL=${SECRET_DB_URL}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest" \
  --update-env-vars NODE_ENV=production \
  --port 4000 \
  --project "$PROJECT_ID" --quiet

run_cmd gcloud run services update-traffic "$SERVICE_NAME" --to-latest --project "$PROJECT_ID" --region "$REGION" --quiet
if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="https://${SERVICE_NAME}-<hash>-as.a.run.app"
  DEPLOYED_REVISION='<dry-run>'
else
  IFS=$'\t' read -r SERVICE_URL DEPLOYED_REVISION < <(
    gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" \
      --format='value(status.url,status.latestReadyRevisionName)'
  )
  [[ -n "$SERVICE_URL" && -n "$DEPLOYED_REVISION" ]] || { echo 'Cloud Run did not return a ready revision.' >&2; exit 1; }
  python3 "$SCRIPT_DIR/smoke_test.py" "$SERVICE_URL"
fi

# ------------------------------------------------------------------------------
# Summary output (URLs; passwords stay in Secret Manager and are not printed)
# ------------------------------------------------------------------------------
printf '\n'
printf '%s\n' "=================================================================="
if [ "$DRY_RUN" = "1" ]; then
  echo 'Dry run only; no Cloud Run resource was changed.'
else
  printf '%s\n' "Deployment Completed!"
fi
printf '%s\n' "Service URL    : ${SERVICE_URL}"
printf '%s\n' "Health Check   : ${SERVICE_URL}/api/health"
printf '%s\n' "Revision       : ${DEPLOYED_REVISION}"
printf '%s\n' "=================================================================="
