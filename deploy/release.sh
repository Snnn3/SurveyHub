#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Required}"
: "${REGION:?Required}"
: "${TEAM_PREFIX:?Required}"
: "${IMAGE_TAG:?Required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validate-resources.sh"
ROLLBACK="${ROLLBACK:-false}"

if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "IMAGE_TAG must be a full 40-character commit SHA." >&2
  exit 1
fi
if [[ "$ROLLBACK" != "true" && "$ROLLBACK" != "false" ]]; then
  echo "ROLLBACK must be true or false." >&2
  exit 1
fi

IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME:$IMAGE_TAG"
DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE_URI" \
  --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
EXPECTED_IMAGE_PREFIX="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME@sha256:"
if [[ "$DIGEST_IMAGE" != "$EXPECTED_IMAGE_PREFIX"* ]]; then
  echo "Could not resolve the team's image to an immutable digest." >&2
  exit 1
fi

if [[ "$ROLLBACK" == "false" ]]; then
  # A failed migration stops the script before the live service is changed.
  gcloud run jobs update "$MIGRATION_JOB_NAME" \
    --image "$DIGEST_IMAGE" --project "$PROJECT_ID" --region "$REGION" --quiet
  gcloud run jobs execute "$MIGRATION_JOB_NAME" \
    --wait --project "$PROJECT_ID" --region "$REGION" --quiet
else
  echo "Rollback requested; reusing the existing image without running migrations."
fi

gcloud run services update "$SERVICE_NAME" \
  --image "$DIGEST_IMAGE" --project "$PROJECT_ID" --region "$REGION" --quiet
gcloud run services update-traffic "$SERVICE_NAME" \
  --to-latest --project "$PROJECT_ID" --region "$REGION" --quiet

IFS=$'\t' read -r SERVICE_URL DEPLOYED_REVISION < <(
  gcloud run services describe "$SERVICE_NAME" \
    --project "$PROJECT_ID" --region "$REGION" \
    --format='value(status.url,status.latestReadyRevisionName)'
)
if [[ -z "$SERVICE_URL" ]]; then
  echo "Cloud Run did not return a service URL." >&2
  exit 1
fi
if [[ -z "$DEPLOYED_REVISION" ]]; then
  echo "Cloud Run did not return a ready revision name." >&2
  exit 1
fi

echo "Service URL: $SERVICE_URL"
echo "Deployed revision: $DEPLOYED_REVISION"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\nDEPLOYED_REVISION=%s\n' \
    "$SERVICE_URL" "$DIGEST_IMAGE" "$DEPLOYED_REVISION" >> "$GITHUB_ENV"
fi
