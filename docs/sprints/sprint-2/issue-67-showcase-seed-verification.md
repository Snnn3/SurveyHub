# Issue #67 showcase seed verification

**Run date:** 2026-11-28 (Asia/Bangkok)  
**Target:** local Docker Compose `surveyhub` database only  
**Environment:** Docker Engine 29.8.0, PostgreSQL 16.15, app image built from `node:20-alpine`  
**Cloud:** not seeded

## Build and seed results

`docker compose ps -a` showed `surveyhub-app` running and `surveyhub-db` healthy. The regular seed owners existed (2 matching `SURVEY_OWNER` rows); the showcase survey IDs did not exist before the run.

`docker compose build app` completed with `Image seproject-app Built`.

The documented seed command initially failed with PostgreSQL authentication because the ignored `.env` connection did not authenticate against the already initialized local database volume. The successful run reused the connection already configured in the running local app container without printing or saving its value:

```powershell
$container = (docker inspect surveyhub-app | ConvertFrom-Json)[0]
$databaseUrlEntry = $container.Config.Env | Where-Object { $_.StartsWith('DATABASE_URL=') } | Select-Object -First 1
$databaseUrl = $databaseUrlEntry.Substring('DATABASE_URL='.Length)
docker compose run --rm --no-deps --name surveyhub-seed-check --env "DATABASE_URL=$databaseUrl" app npm run db:seed:showcase
$databaseUrl = $null
```

Actual seed output:

```text
Ensured 4 showcase surveys with 17 questions.
```

The database query returned:

| Survey | Questions |
|---|---:|
| Learning Experience Pulse | 5 |
| Campus Services Pulse | 4 |
| Team Project Retrospective | 4 |
| Study Habits Check-in | 4 |

Question-type counts were `MULTI_CHOICE 2`, `LONG_TEXT 2`, `YES_NO 2`, `LIKERT 2`, `RATING 2`, `INTEGER 2`, `DATE 2`, plus Sprint 1 compatibility types `SINGLE_CHOICE 1` and `SHORT_TEXT 2`. Showcase response count was `0`.

The same command was run a second time. It again printed `Ensured 4 showcase surveys with 17 questions.` and the follow-up query returned `surveys = 4`, `questions = 17`; no duplicate fixtures were created.

## Target-guard results

Both commands used the built local image, `--no-deps`, and fake unreachable database URLs. Both exited with code `1` at the target guard before `@prisma/client` is required or a database connection is attempted.

Mismatched local/test database:

```powershell
docker compose run --rm --no-deps --name surveyhub-seed-local-guard --env SHOWCASE_SEED_TARGET=local --env "DATABASE_URL=postgresql://not-a-real-user:not-a-real-password@127.0.0.1:1/surveyhub_test" app npm run db:seed:showcase
```

```text
Showcase seed failed: Local showcase seed only accepts the Compose surveyhub database.
```

Cloud environment variables spoofed from the local machine:

```powershell
docker compose run --rm --no-deps --name surveyhub-seed-cloud-guard --env SHOWCASE_SEED_TARGET=cloud --env TEAM_PREFIX=s7c512824 --env GCP_PROJECT_ID=cpe-se-course-2026 --env GCP_REGION=asia-southeast1 --env CLOUD_RUN_JOB=s7c512824-migrate --env "DATABASE_URL=postgresql://not-a-real-user:not-a-real-password@localhost/s7c512824?host=%2Fcloudsql%2Fcpe-se-course-2026%3Aasia-southeast1%3As7c512824-pg" app npm run db:seed:showcase
```

```text
Showcase seed failed: Cloud Run metadata could not be verified; refusing Cloud showcase seed.
```

The second result confirms that setting the expected environment strings locally is insufficient. Real Cloud use still requires the trusted Cloud Run metadata server to report the assigned project and region; no Cloud seed was run.

## Other checks

- `node --check server/prisma/seed-showcase.js` — passed.
- `npm run build` — passed.
- `docker compose build app` — passed.
- `git diff --check` — passed.
- Jest and browser suites were not run; the reviewer-requested seed/database checks above were run directly.
