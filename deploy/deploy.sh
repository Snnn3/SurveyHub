#!/usr/bin/env bash
set -euo pipefail

# First deployment using resources already provisioned by the course portal.
# This script deliberately creates and deletes no GCP resources.

: "${PROJECT_ID:?Set PROJECT_ID from the team resource page}"
: "${REGION:?Set REGION from the team resource page}"
: "${TEAM_PREFIX:?Set TEAM_PREFIX from the team resource page}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-$TEAM_PREFIX}"
IMAGE_NAME="${IMAGE_NAME:-$TEAM_PREFIX}"
SERVICE_NAME="${SERVICE_NAME:-$TEAM_PREFIX}"
MIGRATION_JOB_NAME="${MIGRATION_JOB_NAME:-${TEAM_PREFIX}-migrate}"
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse --verify HEAD)"
IMAGE_TAG="${IMAGE_TAG:-$HEAD_SHA}"

if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "IMAGE_TAG must be a full 40-character commit SHA." >&2
  exit 1
fi

if [[ "$IMAGE_TAG" != "$HEAD_SHA" ]]; then
  echo "IMAGE_TAG ($IMAGE_TAG) must match checkout HEAD ($HEAD_SHA)." >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "Refusing to deploy a dirty checkout; commit the intended source first." >&2
  exit 1
fi

for resource_name in "$ARTIFACT_REPOSITORY" "$IMAGE_NAME" "$SERVICE_NAME" "$MIGRATION_JOB_NAME"; do
  if [[ "$resource_name" != "$TEAM_PREFIX"* ]]; then
    echo "Resource name '$resource_name' is outside this team's prefix." >&2
    exit 1
  fi
done

gcloud config set project "$PROJECT_ID" >/dev/null

# Fail before building if the portal-provisioned resources are not present.
gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" \
  --location "$REGION" --project "$PROJECT_ID" >/dev/null
gcloud run jobs describe "$MIGRATION_JOB_NAME" \
  --region "$REGION" --project "$PROJECT_ID" >/dev/null
gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" --project "$PROJECT_ID" >/dev/null

gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME:$IMAGE_TAG"
docker build --platform "${DOCKER_PLATFORM:-linux/amd64}" --tag "$IMAGE_URI" "$REPO_ROOT"
docker push "$IMAGE_URI"

export PROJECT_ID REGION TEAM_PREFIX ARTIFACT_REPOSITORY IMAGE_NAME
export SERVICE_NAME MIGRATION_JOB_NAME IMAGE_TAG ROLLBACK=false
bash "$SCRIPT_DIR/release.sh"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
python3 "$SCRIPT_DIR/smoke_test.py" "$SERVICE_URL"
