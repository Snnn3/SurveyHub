#!/usr/bin/env bash
set -euo pipefail

# Shared Cloud Run release path for deploy/deploy.sh and GitHub Actions.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validate-resources.sh"
DRY_RUN="${DRY_RUN:-0}"
ROLLBACK="${ROLLBACK:-false}"

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

release_main() {
  : "${PROJECT_ID:?Required}" "${REGION:?Required}" "${TEAM_PREFIX:?Required}" "${IMAGE_TAG:?Required}"
  [[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'DRY_RUN must be 0 or 1.' >&2; return 1; }
  [[ "$ROLLBACK" == true || "$ROLLBACK" == false ]] || { echo 'Invalid rollback mode.' >&2; return 1; }
  [[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full commit SHA.' >&2; return 1; }

  IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$IMAGE_NAME"
  IMAGE_URI="$IMAGE_BASE:$IMAGE_TAG"
  if [[ "$DRY_RUN" == 1 ]]; then
    run_cmd gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)'
    DIGEST_IMAGE="$IMAGE_BASE@sha256:<resolved-at-deploy>"
  else
    DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE_URI" --project "$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
    [[ "$DIGEST_IMAGE" == "$IMAGE_BASE@sha256:"* ]] || { echo 'Image digest not found.' >&2; return 1; }
  fi

  if [[ "$ROLLBACK" == false ]]; then
    assert_portal_config jobs "$MIGRATION_JOB_NAME"
  fi
  assert_portal_config services "$SERVICE_NAME"

  if [[ "$ROLLBACK" == false ]]; then
    # 10. Create/Update & Execute Cloud Run Job for Migration
    run_cmd gcloud run jobs update "$MIGRATION_JOB_NAME" \
      --image "$DIGEST_IMAGE" \
      --remove-env-vars DATABASE_URL \
      --update-secrets "DATABASE_URL=$DATABASE_URL_SECRET:latest" \
      --command npm \
      --args run,db:migrate:deploy \
      --project "$PROJECT_ID" --region "$REGION" --quiet
    if ! run_cmd gcloud run jobs execute "$MIGRATION_JOB_NAME" \
      --wait --project "$PROJECT_ID" --region "$REGION" --quiet; then
      printf '%s\n' "ERROR: Cloud Run migration job '$MIGRATION_JOB_NAME' failed. Aborting service deployment." >&2
      printf '%s\n' "View job logs with:" >&2
      printf '%s\n' "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=$MIGRATION_JOB_NAME\" --project \"$PROJECT_ID\" --limit 50 --format=\"value(textPayload)\"" >&2
      return 1
    fi
  else
    echo 'Rollback requested; switching the service image without running migrations.'
  fi

  # 11. Deploy Cloud Run Service
  if [[ "$ROLLBACK" == true ]]; then
    run_cmd gcloud run services update "$SERVICE_NAME" \
      --image "$DIGEST_IMAGE" \
      --project "$PROJECT_ID" --region "$REGION" --quiet
  else
    run_cmd gcloud run services update "$SERVICE_NAME" \
      --image "$DIGEST_IMAGE" \
      --remove-env-vars DATABASE_URL,JWT_SECRET \
      --update-secrets "DATABASE_URL=$DATABASE_URL_SECRET:latest,JWT_SECRET=$JWT_SECRET_NAME:latest" \
      --update-env-vars NODE_ENV=production \
      --port 4000 \
      --project "$PROJECT_ID" --region "$REGION" --quiet
  fi
  run_cmd gcloud run services update-traffic "$SERVICE_NAME" \
    --to-latest --project "$PROJECT_ID" --region "$REGION" --quiet

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
    [[ -n "$SERVICE_URL" && -n "$DEPLOYED_REVISION" ]] || { echo 'Cloud Run did not return a ready revision.' >&2; return 1; }
  fi

  echo "Service URL: $SERVICE_URL"
  echo "Deployed revision: $DEPLOYED_REVISION"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\nDEPLOYED_REVISION=%s\n' \
      "$SERVICE_URL" "$DIGEST_IMAGE" "$DEPLOYED_REVISION" >> "$GITHUB_ENV"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  release_main "$@"
fi
