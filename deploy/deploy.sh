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
DRY_RUN="${DRY_RUN:-1}"
PROJECT_ID="${PROJECT_ID:-cpe-se-course-2026}"
REGION="${REGION:-asia-southeast1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Shared validation and release logic; the entry point only builds and pushes.
source "$SCRIPT_DIR/release.sh"

[[ $# -eq 0 ]] || { echo "Usage: TEAM_PREFIX=YOUR_TEAM_PREFIX DRY_RUN=1 bash deploy/deploy.sh" >&2; exit 1; }
[[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'DRY_RUN must be 0 or 1.' >&2; exit 1; }

if [[ "$DRY_RUN" == 1 ]]; then
  IMAGE_TAG="${IMAGE_TAG:-0000000000000000000000000000000000000000}"
else
  IMAGE_TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
  [[ "$(git -C "$REPO_ROOT" branch --show-current)" == main ]] || { echo 'Deploy reviewed main only.' >&2; exit 1; }
  [[ "$IMAGE_TAG" == "$(git -C "$REPO_ROOT" rev-parse HEAD)" ]] || { echo 'IMAGE_TAG must match HEAD.' >&2; exit 1; }
  [[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]] || { echo 'Deploy requires a clean checkout.' >&2; exit 1; }
fi
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full commit SHA.' >&2; exit 1; }

echo "=================================================================="
echo "SurveyHub Cloud Run Deployment"
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Team    : $TEAM_PREFIX"
echo "Dry Run : $DRY_RUN"
echo "=================================================================="

# Confirm the portal-provisioned image repository before building.
if [[ "$DRY_RUN" != 1 ]]; then
  gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --location "$REGION" --project "$PROJECT_ID" >/dev/null
fi

# 9. Build & Push the commit-tagged image (from the repo-root Dockerfile).
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME:$IMAGE_TAG"
run_cmd gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
run_cmd docker build --platform linux/amd64 --tag "$IMAGE_URI" "$REPO_ROOT"
run_cmd docker push "$IMAGE_URI"

# 10. Create/Update & Execute Cloud Run Job for Migration
# 11. Deploy Cloud Run Service
# Both steps use release.sh so manual and Actions deployments share one path.
ROLLBACK=false
release_main

if [[ "$DRY_RUN" != 1 ]]; then
  python3 "$SCRIPT_DIR/smoke_test.py" "$SERVICE_URL"
fi

printf '%s\n' "Service URL  : $SERVICE_URL" "Health Check : $SERVICE_URL/api/health" "Revision     : $DEPLOYED_REVISION"
if [[ "$DRY_RUN" == 1 ]]; then
  echo 'Dry run only; no Cloud Run resource was changed.'
fi
