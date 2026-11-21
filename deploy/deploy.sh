#!/usr/bin/env bash
set -euo pipefail

# Manual entry point for the portal-provisioned SurveyHub resources.
DRY_RUN="${DRY_RUN:-1}"
PROJECT_ID="${PROJECT_ID:-cpe-se-course-2026}"
REGION="${REGION:-asia-southeast1}"
TEAM_PREFIX="${TEAM_PREFIX:-s7c512824}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/validate-resources.sh"

[[ $# -eq 0 ]] || { echo 'Usage: DRY_RUN=1 bash deploy/deploy.sh' >&2; exit 1; }
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

IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME:$IMAGE_TAG"
manual_cmd() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[DRY_RUN] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

if [[ "$DRY_RUN" == 0 ]]; then
  # Confirm the assigned resources exist before building or changing them.
  gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --location "$REGION" --project "$PROJECT_ID" >/dev/null
  gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" >/dev/null
  gcloud run jobs describe "$MIGRATION_JOB_NAME" --project "$PROJECT_ID" --region "$REGION" >/dev/null
fi

manual_cmd gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
manual_cmd docker build --platform linux/amd64 --tag "$IMAGE_URI" "$REPO_ROOT"
manual_cmd docker push "$IMAGE_URI"

ROLLBACK=false
source "$SCRIPT_DIR/release.sh"
if [[ "$DRY_RUN" == 0 ]]; then
  python3 "$SCRIPT_DIR/smoke_test.py" "$SERVICE_URL"
fi

printf '%s\n' "Service URL  : $SERVICE_URL" "Health Check : $SERVICE_URL/api/health" "Revision     : $DEPLOYED_REVISION"
if [[ "$DRY_RUN" == 1 ]]; then
  echo 'Dry run only; no Cloud Run resource was changed.'
fi
