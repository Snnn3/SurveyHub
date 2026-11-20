#!/usr/bin/env bash
# Resolve and validate portal-provisioned resource names against TEAM_PREFIX.

: "${TEAM_PREFIX:?TEAM_PREFIX is required}"

ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-$TEAM_PREFIX}"
IMAGE_NAME="${IMAGE_NAME:-$TEAM_PREFIX}"
SERVICE_NAME="${SERVICE_NAME:-$TEAM_PREFIX}"
MIGRATION_JOB_NAME="${MIGRATION_JOB_NAME:-${TEAM_PREFIX}-migrate}"

for resource_name in "$ARTIFACT_REPOSITORY" "$IMAGE_NAME" "$SERVICE_NAME" "$MIGRATION_JOB_NAME"; do
  # Require exact prefix or "<TEAM_PREFIX>-..." so sibling prefixes (e.g. team-1 vs team-10) cannot collide.
  if [[ "$resource_name" != "$TEAM_PREFIX" && "$resource_name" != "${TEAM_PREFIX}-"* ]]; then
    echo "Resource name '$resource_name' is outside team prefix '$TEAM_PREFIX'." >&2
    exit 1
  fi
done
