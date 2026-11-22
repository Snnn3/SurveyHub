# Lab 5 deployment and environment configuration

**Scope:** Issues [#18](https://github.com/Snnn3/SurveyHub/issues/18) (course-portal GCP resource activation), [#19](https://github.com/Snnn3/SurveyHub/issues/19), [#20](https://github.com/Snnn3/SurveyHub/issues/20), [#21](https://github.com/Snnn3/SurveyHub/issues/21), [#22](https://github.com/Snnn3/SurveyHub/issues/22), [#24](https://github.com/Snnn3/SurveyHub/issues/24), and [#37](https://github.com/Snnn3/SurveyHub/issues/37). This guide records portal-provisioned infrastructure, local verification, and deployments run by GitHub Actions.

## Runtime behavior

- The server listens on `PORT`; it defaults to `4000` for local development. Cloud Run supplies `PORT` at runtime.
- The API stores business data in PostgreSQL through Prisma. The application image and container filesystem are not a data store.
- `GET /api/health` checks PostgreSQL and returns `200` when reachable or `503 SERVICE_UNAVAILABLE` when the query fails.
- Production startup rejects missing/default JWT secrets and missing, malformed, credential-less, or default PostgreSQL connection URLs. Configuration errors do not print credentials.
- Seed passwords are required only by the one-off database seed process. The long-running app service does not receive `DEMO_USER_PASSWORD`.

## Environment variables

| Variable | Used by | Purpose and source | Secret? |
|---|---|---|---|
| `PORT` | Server; Compose sets local port `4000` | Listening port; Cloud Run supplies its runtime value. | No |
| `NODE_ENV` | Server; Compose sets `production` | Selects runtime mode; set to `production` on Cloud Run. | No |
| `DATABASE_URL` | Server and seed/migration commands | PostgreSQL connection for application data. Cloud Run receives it from Secret Manager or a secret environment setting; Compose builds it from `POSTGRES_PASSWORD`. | Yes |
| `DATABASE_URL_TEST` | Jest, E2E, and benchmark commands | Separate connection to `surveyhub_test`; local `.env` points to the host-mapped database. Do not configure it on the Cloud Run app. | Yes |
| `JWT_SECRET` | Server; Compose passes it to app | Signs and verifies sessions. Supply a random value of at least 32 characters through Secret Manager or an ignored local `.env`. | Yes |
| `JWT_EXPIRES_IN` | Server; Compose sets `8h` | JWT lifetime; defaults to `8h`. | No |
| `CLIENT_ORIGIN` | Server; Compose sets `http://localhost:4000` | Allowed browser origin for CORS; configure the deployed client origin when it is hosted separately. | No |
| `VITE_API_BASE_URL` | Vite client build | API base URL at client build time; defaults to same-origin `/api`. | No |
| `DEMO_USER_PASSWORD` | Seed process only | Password assigned to all four synthetic seed accounts. For host seeding, set it in ignored root `.env`; for Compose, use the ignored `.env.seed` file only for the one-off seed command. Production seed jobs must receive it from a secret source and use a value of at least 12 characters other than the fixed test password. | Yes |
| `POSTGRES_PASSWORD` | Compose PostgreSQL service | Local database password; Compose uses it to initialize PostgreSQL and construct the app's `DATABASE_URL`. Set it in ignored root `.env`. | Yes |
| `POSTGRES_PORT` | Compose | Host loopback port mapped to PostgreSQL's container port `5432`; defaults to `5432`. Set another free port if the default is occupied and update local database URLs accordingly. | No |
| `POSTGRES_USER` | Compose PostgreSQL service | Static local database user, `postgres`. | No |
| `POSTGRES_DB` | Compose PostgreSQL service | Static primary database name, `surveyhub`; the initialization script also creates `surveyhub_test`. | No |

The root and server `.env.example` files contain placeholders only. Never commit `.env`, `.env.seed`, or real deployment values. `POSTGRES_PASSWORD` and both local database URLs must use the same value. For production, provide `DATABASE_URL` and `JWT_SECRET` from Cloud Run's secret configuration; do not use local defaults. Apply schema migrations as a deployment step, and run the seed only when synthetic accounts are intentionally needed.

## Compose setup and persistence check

Use Docker Compose v2.30 or newer for `--env-from-file`. This is the current Issue #19 setup; Part F §1.3 documents the older `v0.1.0-sprint1` release separately. Starting from a clean checkout containing these changes:

```bash
cp .env.example .env
# Replace the example values in the ignored .env; use distinct random JWT, database, and demo passwords.
cp .env.seed.example .env.seed
# Replace its placeholder with the same DEMO_USER_PASSWORD value from .env.
docker compose build app
docker compose up -d db
docker compose run --rm app npm run db:migrate:deploy
docker compose run --rm --env-from-file .env.seed app npm run db:seed
docker compose up -d app
curl http://localhost:4000/api/health
```

The ignored `.env.seed` contains only `DEMO_USER_PASSWORD`; its value must match the demo password in `.env`. The default database host port is `5432`; if it is busy, set `POSTGRES_PORT` and update the host in `DATABASE_URL` and `DATABASE_URL_TEST` in `.env`. Compose exposes PostgreSQL only on loopback.

To verify the seeded data survives application recreation and a Compose stop/start, run:

```bash
docker compose exec -T db psql -U postgres -d surveyhub -c "SELECT email FROM users WHERE email='owner1@survey.local';"
docker compose up -d --force-recreate app
docker compose down
docker compose up -d db app
docker compose exec -T db psql -U postgres -d surveyhub -c "SELECT email FROM users WHERE email='owner1@survey.local';"
```

The query should return the same seeded account before and after the restart. Compose uses the named volume `surveyhub_postgres_data`; `docker compose down` preserves it. Do not add `-v` when checking persistence. `DATABASE_URL_TEST` remains a separate database; integration tests and E2E tests must use it rather than the seeded `surveyhub` database.

### Existing volume created with the old default password

Changing `POSTGRES_PASSWORD` in `.env` does not change the password stored inside an already initialized PostgreSQL volume. To keep that data and move it off the old `postgres` default:

1. Set a new random `POSTGRES_PASSWORD` in the ignored `.env`, and use the same value in `DATABASE_URL` and `DATABASE_URL_TEST`.
2. While the existing database container is running, open an interactive SQL session:

   ```bash
   docker compose exec db psql -U postgres -d postgres
   ```

   At the `psql` prompt, run `\password postgres`, enter the new value from `.env` when prompted, then run `\q`. The password prompt avoids placing the value in shell history.
3. Recreate the app with `docker compose up -d --force-recreate app` so new database connections use the updated URL.

This changes the database role password in place; it does not remove or reinitialize the volume. Keep the app stopped or recreate it promptly after the password change so it does not open new connections using the old value.

## Cloud Run configuration

Deploy the built image with `NODE_ENV=production`, Cloud Run's injected `PORT`, a valid PostgreSQL `DATABASE_URL` connected to managed Cloud SQL, and `JWT_SECRET` supplied from Secret Manager or a secret environment variable. For a Cloud SQL Unix socket, attach the instance to the Cloud Run service and use Prisma's localhost URL form, for example `postgresql://USER:PASSWORD@localhost/DB_NAME?host=/cloudsql/PROJECT:REGION:INSTANCE`; the `host` query value is the mounted socket directory. Include `@localhost` in the URL authority; production validation rejects hostless `@/DB_NAME` URLs. URL-encode reserved characters in the username or password. Set `CLIENT_ORIGIN` to the browser origin when the frontend is separate. Keep `DATABASE_URL_TEST` out of the app service. Configure `DEMO_USER_PASSWORD` only on an intentional one-off seed job; never bake it into the image or leave it in the running app service. Use `/api/health` as the readiness probe.

## Course Portal GCP Resources (Issue #18)

Course-managed GCP infrastructure was activated through the CPE334 Student Cloud Portal on `main` (`b7e12f7`). Only non-secret resource names, service identifiers, and Secret Manager references are recorded below; secret values and personal account details remain excluded from Git.

### Portal Connection Summary

| Field | Value |
|---|---|
| Portal mode / status | `live` / `ready` (**Resources ready**) |
| Connected GitHub repository | `Snnn3/SurveyHub` (`main`, `github_connected: true`) |
| Google Cloud provisioned | `true` (`application_deployed_by_portal: false`) |
| GCP Project ID | `cpe-se-course-2026` |
| GCP Region | `asia-southeast1` |
| Assigned team prefix | `s7c512824` |
| Assigned Cloud Run URL | `https://s7c512824-4d7hbszvwq-as.a.run.app` |

### Provisioned Resource Names and Secret References

| Item | Assigned Resource / Reference Name | Purpose |
|---|---|---|
| Cloud Run service | `s7c512824` | Runs the SurveyHub container |
| Migration job | `s7c512824-migrate` | Runs Prisma migrations prior to updating the service |
| Cloud SQL instance | `s7c512824-pg` (`db-f1-micro`) | Managed PostgreSQL instance |
| Database / DB user | `s7c512824` / `s7c512824` | PostgreSQL database and role name (password in Secret Manager) |
| SQL connection name | `cpe-se-course-2026:asia-southeast1:s7c512824-pg` | Cloud SQL Unix socket attachment identifier |
| Artifact Registry repository | `s7c512824` | Stores team Docker images |
| Image repository URI | `asia-southeast1-docker.pkg.dev/cpe-se-course-2026/s7c512824/s7c512824` | Immutable commit SHA / `@sha256` push target |
| Runtime service account | `s7c512824-runner@cpe-se-course-2026.iam.gserviceaccount.com` | Identity used by the Cloud Run service and migration job |
| Deployer service account | `s7c512824-deployer@cpe-se-course-2026.iam.gserviceaccount.com` | Keyless GitHub Actions OIDC deployer identity |
| Workload Identity pool / provider | `s7c512824-pool` / `s7c512824-provider` | Keyless authentication pool and GitHub OIDC provider |
| Logs view | `projects/cpe-se-course-2026/locations/global/buckets/_Default/views/s7c512824` | Team-scoped Cloud Logging view |
| `DATABASE_URL` secret ref | `s7c512824-database-url` | Secret Manager reference name only |
| `ADMIN_PASSWORD` secret ref | `s7c512824-admin-password` | Secret Manager reference name only |
| `DEMO_USER_PASSWORD` secret ref | `s7c512824-demo-password` | Secret Manager reference name only (seed use only) |

### Handoff for Issue #21 and #22

- **GitHub `demo` environment variables (`#21`):** Restrict the `demo` environment to the `main` branch. Set these five variables from Team Resources:
  - `GCP_PROJECT_ID`: `cpe-se-course-2026`
  - `GCP_REGION`: `asia-southeast1`
  - `TEAM_PREFIX`: the assigned prefix shown in Team Resources
  - `WIF_PROVIDER`: `projects/670075229477/locations/global/workloadIdentityPools/s7c512824-pool/providers/s7c512824-provider`
  - `WIF_SERVICE_ACCOUNT`: `s7c512824-deployer@cpe-se-course-2026.iam.gserviceaccount.com`
- The workflow reads `TEAM_PREFIX` from the `demo` environment and rejects a mismatch with the portal-provided WIF service-account name before deployment. For a local preview, run `TEAM_PREFIX=YOUR_TEAM_PREFIX DRY_RUN=1 bash deploy/deploy.sh`, replacing `YOUR_TEAM_PREFIX` with the value from Team Resources. Resource-name variables default from `TEAM_PREFIX`: `ARTIFACT_REPOSITORY`, `IMAGE_NAME`, `SERVICE_NAME`, `MIGRATION_JOB_NAME`, `DATABASE_URL_SECRET`, and `JWT_SECRET_NAME`. These settings are resource/reference names, not secret values.
- **Repository push restriction (`#18` / `#21`):** Branch protection on `main` must still be confirmed/enabled by the repository owner (`Snnn3`) so only authorized team workflows/PRs land on `main`.
- **Additional secret for app startup (`#22`):** Production mode requires a non-default `JWT_SECRET` of at least 32 characters (`server/src/config/environment.ts`). Store it in `s7c512824-app-secret-1`; the release workflow maps that Secret Manager reference to `JWT_SECRET` on the service. Never store the value in GitHub variables or Git.

Before changing either Cloud Run resource, `deploy/release.sh` reads its configuration and stops unless the assigned Cloud SQL connection and runtime service account are still attached. It does not print the configuration, which may contain secret references. A normal deployment removes any plain `DATABASE_URL`/`JWT_SECRET` environment entries before mapping those names to Secret Manager; other portal settings are preserved. The required Secret Manager versions must already exist and be accessible to the runtime service account.

Before running **Deploy SurveyHub** on `main`, restrict the GitHub `demo` environment to deployments from `main` only. Also confirm the `DATABASE_URL` secret and `s7c512824-app-secret-1` each have an accessible latest version; the workflow does not create secret versions.

For a manual rollback, run **Deploy SurveyHub** from `main` with `image_tag` set to the full SHA of an image published by this workflow. CI and build are skipped because that image's commit passed CI when published. The rollback checks the current Cloud Run service configuration, then switches only the service image and traffic; it does not inspect or execute the migration job or change runtime settings.

## Cloud Run deployment evidence (Issue #22)

Public URL: [SurveyHub](https://s7c512824-4d7hbszvwq-as.a.run.app). The image digests below refer to the team Artifact Registry repository listed above.

| Deployment | Source commit on `main` | Image digest | Migration execution | Cloud Run revision |
|---|---|---|---|---|
| [Release A](https://github.com/Snnn3/SurveyHub/actions/runs/44908360347) | `73e576ea718f57dfb91535006a442011cf8974a8` | `sha256:6756d5858b8aef01a105db977302f4763be67a331328beaeeea46ebec1f57ded` | `s7c512824-migrate-lqzg5` | `s7c512824-00003-nbs` |
| [PR #50 deployment](https://github.com/Snnn3/SurveyHub/actions/runs/44997453351) | `c35ff745c69c3864873973fc2a06b9ef2e39b396` | `sha256:da6e028d8e64f84eb9bdc1ae9b9306e82a233a5bae123e34dbe8a05cf9099dd0` | `s7c512824-migrate-btqk2` | `s7c512824-00005-7qz` |

Both Actions runs built and published the commit image, completed the migration job before updating the service, and passed the public UI, database health, and unauthenticated access checks.

On 2026-11-22 the public UI and `GET /api/health` both returned HTTP `200`. The health response included `database: up`. Cloud Run reported revision `s7c512824-00005-7qz` serving 100% of traffic. The service and migration job were attached to `cpe-se-course-2026:asia-southeast1:s7c512824-pg` and used the assigned runtime account. Both mapped `DATABASE_URL` from `s7c512824-database-url:latest`. The service also mapped `JWT_SECRET` from `s7c512824-app-secret-1:latest`. The migration job was configured to run `npm run db:migrate:deploy` on the recorded image digest.

### C-04 and persistence handoff

C-04 is pending. On the public service, sign in with synthetic owner and respondent accounts, create and publish a survey, and submit a response. Capture a forbidden response from the authenticated respondent's attempt to read the owner-only survey details, checking that the response contains no protected survey data.

Record the synthetic survey and response IDs with the revision tested, then link the evidence from #24. Release A above is a historical deployment baseline. There is no captured evidence yet of a synthetic record on that revision for the C-05 persistence comparison.
