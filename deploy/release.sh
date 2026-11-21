#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Required}" "${REGION:?Required}" "${TEAM_PREFIX:?Required}" "${IMAGE_TAG:?Required}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validate-resources.sh"
DRY_RUN="${DRY_RUN:-0}"
ROLLBACK="${ROLLBACK:-false}"
[[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'DRY_RUN must be 0 or 1.' >&2; exit 1; }
[[ "$ROLLBACK" == true || "$ROLLBACK" == false ]] || { echo 'Invalid rollback mode.' >&2; exit 1; }
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full commit SHA.' >&2; exit 1; }

release_cmd() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[DRY_RUN] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME"
IMAGE_URI="$IMAGE_BASE:$IMAGE_TAG"
if [[ "$DRY_RUN" == 1 ]]; then
  release_cmd gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)'
  DIGEST_IMAGE="$IMAGE_BASE@sha256:<resolved-at-deploy>"
else
  DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
  [[ "$DIGEST_IMAGE" == "$IMAGE_BASE@sha256:"* ]] || { echo 'Image digest not found.' >&2; exit 1; }
fi

# Read the portal configuration without printing secret-backed environment values.
assert_portal_config() {
  local kind="$1" name="$2" config
  if [[ "$DRY_RUN" == 1 ]]; then
    echo "[DRY_RUN] Would verify Cloud SQL and runtime identity on Cloud Run $kind '$name'."
    return
  fi
  config="$(gcloud run "$kind" describe "$name" --project "$PROJECT_ID" --region "$REGION" --format=json)"
  [[ "$config" == *"$PROJECT_ID:$REGION:${TEAM_PREFIX}-pg"* ]] || {
    echo "Assigned Cloud SQL instance is not attached to Cloud Run $kind '$name'." >&2
    exit 1
  }
  [[ "$config" == *"${TEAM_PREFIX}-runner@$PROJECT_ID.iam.gserviceaccount.com"* ]] || {
    echo "Assigned runtime service account is not configured on Cloud Run $kind '$name'." >&2
    exit 1
  }
}

assert_portal_config jobs "$MIGRATION_JOB_NAME"
assert_portal_config services "$SERVICE_NAME"

if [[ "$ROLLBACK" == false ]]; then
  release_cmd gcloud run jobs update "$MIGRATION_JOB_NAME" \
    --image "$DIGEST_IMAGE" \
    --update-secrets "DATABASE_URL=${DATABASE_URL_SECRET}:latest" \
    --command npm \
    --args run,db:migrate:deploy \
    --project "$PROJECT_ID" --region "$REGION" --quiet
  release_cmd gcloud run jobs execute "$MIGRATION_JOB_NAME" \
    --wait --project "$PROJECT_ID" --region "$REGION" --quiet
else
  echo 'Rollback requested; run the configured migration job before reusing the prior image.'
  release_cmd gcloud run jobs execute "$MIGRATION_JOB_NAME" \
    --wait --project "$PROJECT_ID" --region "$REGION" --quiet
fi

release_cmd gcloud run services update "$SERVICE_NAME" \
  --image "$DIGEST_IMAGE" \
  --update-secrets "DATABASE_URL=${DATABASE_URL_SECRET}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest" \
  --update-env-vars NODE_ENV=production \
  --port 4000 \
  --project "$PROJECT_ID" --region "$REGION" --quiet
release_cmd gcloud run services update-traffic "$SERVICE_NAME" \
  --to-latest --project "$PROJECT_ID" --region "$REGION" --quiet

if [[ "$DRY_RUN" == 1 ]]; then
  release_cmd gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" \
    --format='value(status.url,status.latestReadyRevisionName)'
  SERVICE_URL="https://${SERVICE_NAME}-<hash>-as.a.run.app"
  DEPLOYED_REVISION='<dry-run>'
else
  IFS=$'\t' read -r SERVICE_URL DEPLOYED_REVISION < <(
    gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" \
      --format='value(status.url,status.latestReadyRevisionName)'
  )
  [[ -n "$SERVICE_URL" && -n "$DEPLOYED_REVISION" ]] || { echo 'Cloud Run did not return a ready revision.' >&2; exit 1; }
fi

echo "Service URL: $SERVICE_URL"
echo "Deployed revision: $DEPLOYED_REVISION"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\nDEPLOYED_REVISION=%s\n' \
    "$SERVICE_URL" "$DIGEST_IMAGE" "$DEPLOYED_REVISION" >> "$GITHUB_ENV"
fi
