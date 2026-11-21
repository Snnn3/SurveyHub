#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SurveyHub — Manual Google Cloud Run Deployment Script
# ==============================================================================
# Usage:
#   DRY_RUN=1 bash deploy/deploy.sh
#
# Environment Variables (Optional):
#   PROJECT_ID   GCP Project ID (defaults to the assigned course project)
#   TEAM_PREFIX  Assigned team prefix (pinned by the resource validator)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES (manual deployment; safe to re-run)
#   Updates only the portal-provisioned resources assigned to this team:
#   9 build image   10 run migration job   11 update Cloud Run service
#   Routine releases run through GitHub Actions (deploy.yml -> release.sh).
#
# ⭐ IMPORTANT
#   - Portal resources and Secret Manager values are reused, never created here.
#   - Secret values are never read or printed (run_cmd redacts --password=...).
#   - Preview first with: DRY_RUN=1 bash deploy/deploy.sh (no external calls)
#   - Run from the REPO ROOT (step 9 builds the root Dockerfile).
#   - Offline test: deploy/tests/test_deploy_safety.sh
#
# REFERENCES
#   - gcloud run deploy : https://cloud.google.com/sdk/gcloud/reference/run/deploy
#   - Cloud Run jobs    : https://cloud.google.com/run/docs/create-jobs
#   - Cloud SQL + Run   : https://cloud.google.com/sql/docs/postgres/connect-run
#   - Secret Manager    : https://cloud.google.com/secret-manager/docs
#   - Artifact Registry : https://cloud.google.com/artifact-registry/docs/docker
#
# ⭐ CHANGE ME — review app-specific values before reusing this structure:
#   # CHANGE ME: project prefix and assigned resource names
#   # CHANGE ME: migration command for your stack (step 10)
#   # CHANGE ME: container port (step 11)
# ==============================================================================

# ------------------------------------------------------------------------------
# Settings & argument parsing
# ------------------------------------------------------------------------------
DRY_RUN="${DRY_RUN:-1}"
PROJECT_ID="${PROJECT_ID:-cpe-se-course-2026}"
REGION="${REGION:-asia-southeast1}"
TEAM_PREFIX="${TEAM_PREFIX:-s7c512824}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
[[ $# -eq 0 ]] || { echo 'Usage: DRY_RUN=1 bash deploy/deploy.sh' >&2; exit 1; }
[[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'DRY_RUN must be 0 or 1.' >&2; exit 1; }
[[ "$PROJECT_ID" == "cpe-se-course-2026" ]] || { echo 'Wrong course project.' >&2; exit 1; }
[[ "$REGION" == "asia-southeast1" ]] || { echo 'Wrong assigned region.' >&2; exit 1; }
source "$SCRIPT_DIR/validate-resources.sh"

# Helper: prints the command (DRY_RUN=1) or prints then executes it.
# ⭐ IMPORTANT: --password=... is redacted in the log; keep this behaviour.
run_cmd() {
  # Log the command without exposing generated database credentials.
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

if [ "$DRY_RUN" = "1" ]; then
  IMAGE_TAG="${IMAGE_TAG:-0000000000000000000000000000000000000000}"
else
  IMAGE_TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
  [[ "$(git -C "$REPO_ROOT" branch --show-current)" == "main" ]] || { echo 'Deploy reviewed main only.' >&2; exit 1; }
  [[ "$IMAGE_TAG" == "$(git -C "$REPO_ROOT" rev-parse HEAD)" ]] || { echo 'IMAGE_TAG must match HEAD.' >&2; exit 1; }
  [[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]] || { echo 'Deploy requires a clean checkout.' >&2; exit 1; }
fi
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full commit SHA.' >&2; exit 1; }
REPO_NAME="$ARTIFACT_REPOSITORY"
MIGRATE_JOB_NAME="$MIGRATION_JOB_NAME"
SQL_INSTANCE="${TEAM_PREFIX}-pg"
SA_NAME="${TEAM_PREFIX}-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME"
IMAGE_URI="$IMAGE_BASE:$IMAGE_TAG"

echo "=================================================================="
echo "SurveyHub Cloud Run Deployment"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Team    : ${TEAM_PREFIX}"
echo "Dry Run : ${DRY_RUN}"
echo "=================================================================="

# ==============================================================================
# The portal/TA provisions Cloud Run, Cloud SQL, registry, service accounts and secrets.
# Verify the assigned configuration without printing its secret-backed values.
if [ "$DRY_RUN" != "1" ]; then
  gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null
  SERVICE_CONFIG="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format=json)"
  JOB_CONFIG="$(gcloud run jobs describe "$MIGRATE_JOB_NAME" --project "$PROJECT_ID" --region "$REGION" --format=json)"
  assert_portal_config services "$SERVICE_NAME" "$SERVICE_CONFIG"
  assert_portal_config jobs "$MIGRATE_JOB_NAME" "$JOB_CONFIG"
else
  assert_portal_config services "$SERVICE_NAME"
  assert_portal_config jobs "$MIGRATE_JOB_NAME"
fi
# 9. Build & Push Unified Container Image via Cloud Build
#    Builds the root Dockerfile (run this script from the repo root).
#    The image is tagged with the full source commit SHA.
# ==============================================================================
run_cmd gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
run_cmd docker build --platform linux/amd64 --tag "$IMAGE_URI" "$REPO_ROOT"
run_cmd docker push "$IMAGE_URI"
if [[ "$DRY_RUN" == 1 ]]; then
  run_cmd gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)'
  DIGEST_IMAGE="$IMAGE_BASE@sha256:<resolved-at-deploy>"
else
  DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
  [[ "$DIGEST_IMAGE" == "$IMAGE_BASE@sha256:"* ]] || { echo 'Missing image digest.' >&2; exit 1; }
fi

# ==============================================================================
# 10. Create/Update & Execute Cloud Run Job for Migration
#     ⭐ IMPORTANT: if this job fails the script stops BEFORE deploying the
#        service, so a broken migration never reaches users.
#     CHANGE ME: this npm command is specific to the SurveyHub Prisma setup.
#     deploy.yml / release.sh later run this same job.
# ==============================================================================
run_cmd gcloud run jobs update "$MIGRATE_JOB_NAME" \
  --image "$DIGEST_IMAGE" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --set-cloudsql-instances "$SQL_CONN_NAME" \
  --remove-env-vars DATABASE_URL \
  --update-secrets "DATABASE_URL=${DATABASE_URL_SECRET}:latest" \
  --command npm \
  --args run,db:migrate:deploy \
  --max-retries 1 \
  --task-timeout 300s \
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
#     CHANGE ME: --port must equal the port in the SurveyHub Dockerfile (4000).
#     Portal-managed Cloud SQL, identity, and scaling settings are preserved.
# ==============================================================================
run_cmd gcloud run services update "$SERVICE_NAME" \
  --image "$DIGEST_IMAGE" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --add-cloudsql-instances "$SQL_CONN_NAME" \
  --remove-env-vars DATABASE_URL,JWT_SECRET \
  --update-secrets "DATABASE_URL=${DATABASE_URL_SECRET}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest" \
  --update-env-vars NODE_ENV=production \
  --port 4000 \
  --project "$PROJECT_ID" --quiet

run_cmd gcloud run services update-traffic "$SERVICE_NAME" --to-latest --project "$PROJECT_ID" --region "$REGION" --quiet
if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="https://${SERVICE_NAME}-<hash>-as.a.run.app"
  DEPLOYED_REVISION='<dry-run>'
else
  IFS=$'\t' read -r SERVICE_URL DEPLOYED_REVISION < <(
    gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url,status.latestReadyRevisionName)'
  )
  [[ -n "$SERVICE_URL" && -n "$DEPLOYED_REVISION" ]] || { echo 'Cloud Run did not return a ready revision.' >&2; exit 1; }
  python3 "$SCRIPT_DIR/smoke_test.py" "$SERVICE_URL"
fi

# ------------------------------------------------------------------------------
# Summary output (URLs; secret values stay in Secret Manager and are not printed)
# ------------------------------------------------------------------------------
printf '\n'
printf '%s\n' "=================================================================="
printf '%s\n' "Deployment Completed!"
printf '%s\n' "Service URL    : ${SERVICE_URL}"
printf '%s\n' "Health Check   : ${SERVICE_URL}/api/health"
printf '%s\n' "Revision       : ${DEPLOYED_REVISION}"
printf '%s\n' "Image          : ${DIGEST_IMAGE}"
if [ "$DRY_RUN" = "1" ]; then
  echo 'Dry run only; no Cloud Run resource was changed.'
fi
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\nDEPLOYED_REVISION=%s\n' \
    "$SERVICE_URL" "$DIGEST_IMAGE" "$DEPLOYED_REVISION" >> "$GITHUB_ENV"
fi
printf '%s\n' "=================================================================="
