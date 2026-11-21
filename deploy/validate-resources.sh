#!/usr/bin/env bash
# Resolve and validate portal-provisioned resource names against TEAM_PREFIX.

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${TEAM_PREFIX:?TEAM_PREFIX is required}"
[[ "$PROJECT_ID" == "cpe-se-course-2026" ]] || { echo 'Wrong course project.' >&2; exit 1; }
[[ "$REGION" == "asia-southeast1" ]] || { echo 'Wrong assigned region.' >&2; exit 1; }
export ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-$TEAM_PREFIX}"
export IMAGE_NAME="${IMAGE_NAME:-$TEAM_PREFIX}"
export SERVICE_NAME="${SERVICE_NAME:-$TEAM_PREFIX}"
export MIGRATION_JOB_NAME="${MIGRATION_JOB_NAME:-${TEAM_PREFIX}-migrate}"
export DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-${TEAM_PREFIX}-database-url}"
export JWT_SECRET_NAME="${JWT_SECRET_NAME:-${TEAM_PREFIX}-app-secret-1}"

for resource_name in "$ARTIFACT_REPOSITORY" "$IMAGE_NAME" "$SERVICE_NAME" "$MIGRATION_JOB_NAME" "$DATABASE_URL_SECRET" "$JWT_SECRET_NAME"; do
  # Require exact prefix or "<TEAM_PREFIX>-..." so sibling prefixes (e.g. team-1 vs team-10) cannot collide.
  if [[ "$resource_name" != "$TEAM_PREFIX" && "$resource_name" != "${TEAM_PREFIX}-"* ]]; then
    echo "Resource name '$resource_name' is outside team prefix '$TEAM_PREFIX'." >&2
    exit 1
  fi
done

assert_portal_config() {
  local kind="$1" name="$2" config="${3:-}"
  if [[ "${DRY_RUN:-0}" == 1 ]]; then
    echo "[DRY_RUN] Would verify Cloud SQL and runtime identity on Cloud Run $kind '$name'."
    return
  fi
  if [[ -z "$config" ]]; then
    config="$(gcloud run "$kind" describe "$name" --project "$PROJECT_ID" --region "$REGION" --format=json)"
  fi
  [[ "$config" == *"$PROJECT_ID:$REGION:${TEAM_PREFIX}-pg"* ]] || {
    echo "Assigned Cloud SQL instance is not attached to Cloud Run $kind '$name'." >&2
    return 1
  }
  [[ "$config" == *"${TEAM_PREFIX}-runner@$PROJECT_ID.iam.gserviceaccount.com"* ]] || {
    echo "Assigned runtime service account is not configured on Cloud Run $kind '$name'." >&2
    return 1
  }
}
