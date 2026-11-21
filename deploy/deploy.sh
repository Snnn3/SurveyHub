#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SurveyHub — Manual Google Cloud Run Deployment Script
# ==============================================================================
# Usage:
#   TEAM_PREFIX=YOUR_TEAM_PREFIX DRY_RUN=1 bash deploy/deploy.sh
#
# Required environment:
#   TEAM_PREFIX  Prefix shown in Student Cloud Team Resources
#
# Optional environment:
#   PROJECT_ID   GCP Project ID (default: cpe-se-course-2026)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set to 1 to print commands without executing them (default: 1)
#
# This updates only the portal-provisioned resources assigned to TEAM_PREFIX.
# Normal releases use GitHub Actions (deploy.yml -> release.sh).
# ==============================================================================

# ------------------------------------------------------------------------------
# Settings & argument parsing
# ------------------------------------------------------------------------------
DRY_RUN="${DRY_RUN:-1}"
PROJECT_ID="${PROJECT_ID:-cpe-se-course-2026}"
REGION="${REGION:-asia-southeast1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/validate-resources.sh"

run_cmd() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[DRY_RUN] '
  else
    printf '+ '
  fi
  printf '%q ' "$@"
  printf '\n'
  if [[ "$DRY_RUN" != 1 ]]; then
    "$@"
  fi
}

[[ $# -eq 0 ]] || { echo "Usage: TEAM_PREFIX=YOUR_TEAM_PREFIX DRY_RUN=1 bash deploy/deploy.sh" >&2; exit 1; }
[[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'DRY_RUN must be 0 or 1.' >&2; exit 1; }

# Use the Starter Kit names for the validated repository and migration job.
REPO_NAME="$ARTIFACT_REPOSITORY"
MIGRATE_JOB_NAME="$MIGRATION_JOB_NAME"
if [[ "$DRY_RUN" == 1 ]]; then
  IMAGE_TAG="${IMAGE_TAG:-0000000000000000000000000000000000000000}"
else
  IMAGE_TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
  [[ "$(git -C "$REPO_ROOT" branch --show-current)" == main ]] || { echo 'Deploy reviewed main only.' >&2; exit 1; }
  [[ "$IMAGE_TAG" == "$(git -C "$REPO_ROOT" rev-parse HEAD)" ]] || { echo 'IMAGE_TAG must match HEAD.' >&2; exit 1; }
  [[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]] || { echo 'Deploy requires a clean checkout.' >&2; exit 1; }
fi
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full commit SHA.' >&2; exit 1; }
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${IMAGE_TAG}"

SECRET_DB_URL="$DATABASE_URL_SECRET"
JOB_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest"

echo "=================================================================="
echo "SurveyHub Cloud Run Deployment"
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Team    : $TEAM_PREFIX"
echo "Dry Run : $DRY_RUN"
echo "=================================================================="

# ==============================================================================
# The course portal provisions the registry, Cloud SQL, Cloud Run and IAM.
# ==============================================================================
if [ "$DRY_RUN" != "1" ]; then
  gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null
fi
assert_portal_config services "$SERVICE_NAME"
assert_portal_config jobs "$MIGRATE_JOB_NAME"

# ==============================================================================
# 9. Build & Push Unified Container Image
# ==============================================================================
cd "$REPO_ROOT"
run_cmd gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
run_cmd docker build --platform linux/amd64 --tag "$IMAGE_URI" .
run_cmd docker push "$IMAGE_URI"
if [ "$DRY_RUN" != "1" ]; then
  IMAGE_URI="$(gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
  [[ "$IMAGE_URI" == "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}@sha256:"* ]] || { echo 'Image digest not found.' >&2; exit 1; }
else
  run_cmd gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)'
  IMAGE_URI="${IMAGE_URI%:*}@sha256:<resolved-at-deploy>"
fi

# ==============================================================================
# 10. Create/Update & Execute Cloud Run Job for Migration
# Keep the Starter Kit step structure here; GitHub Actions uses release.sh.
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

if [[ "$DRY_RUN" == 1 ]]; then
  run_cmd gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" \
    --format='value(status.url,status.latestReadyRevisionName)'
  SERVICE_URL="https://$SERVICE_NAME-<hash>-as.a.run.app"
  DEPLOYED_REVISION='<dry-run>'
else
  IFS=$'\t' read -r SERVICE_URL DEPLOYED_REVISION < <(
    gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" \
      --format='value(status.url,status.latestReadyRevisionName)'
  )
  [[ -n "$SERVICE_URL" && -n "$DEPLOYED_REVISION" ]] || { echo 'Cloud Run did not return a ready revision.' >&2; exit 1; }
  python3 "$SCRIPT_DIR/smoke_test.py" "$SERVICE_URL"
fi

printf '%s\n' "Service URL  : $SERVICE_URL" "Health Check : $SERVICE_URL/api/health" "Revision     : $DEPLOYED_REVISION"
if [[ "$DRY_RUN" == 1 ]]; then
  echo 'Dry run only; no Cloud Run resource was changed.'
fi
