# Lab 5 deployment and environment configuration

**Scope:** Issue [#18](https://github.com/Snnn3/SurveyHub/issues/18) (course-portal GCP resource activation) and Issue [#19](https://github.com/Snnn3/SurveyHub/issues/19), consolidated with [#20](https://github.com/Snnn3/SurveyHub/issues/20). This records portal-provisioned infrastructure metadata and reproducible local verification; the application image has not yet been deployed to Cloud Run (`application_deployed_by_portal: false`).

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
| Assigned Cloud Run URL | `https://s7c512824-4d7hbszvwq-as.a.run.app` (app not deployed until #22) |

### Provisioned Resource Names and Secret References

| Item | Assigned Resource / Reference Name | Purpose |
|---|---|---|
| Cloud Run service | `s7c512824` | Runs the SurveyHub container once deployed |
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

- **GitHub `demo` environment variables (`#21`):** Restrict the `demo` environment to the `main` branch. Set these four required variables from Team resources:
  - `GCP_PROJECT_ID`: `cpe-se-course-2026`
  - `GCP_REGION`: `asia-southeast1`
  - `WIF_PROVIDER`: `projects/670075229477/locations/global/workloadIdentityPools/s7c512824-pool/providers/s7c512824-provider`
  - `WIF_SERVICE_ACCOUNT`: `s7c512824-deployer@cpe-se-course-2026.iam.gserviceaccount.com`
- `TEAM_PREFIX` is pinned in the workflow to `s7c512824`; it is not a GitHub variable. Optional resource-name variables are only needed if Team resources differ from defaults: `ARTIFACT_REPOSITORY` (`s7c512824`), `IMAGE_NAME` (`s7c512824`), `SERVICE_NAME` (`s7c512824`), and `MIGRATION_JOB_NAME` (`s7c512824-migrate`). `DATABASE_URL_SECRET` defaults to `s7c512824-database-url`; `JWT_SECRET_NAME` defaults to the `s7c512824-app-secret-1` reference. These are resource/reference names, not secret values.
- **Repository push restriction (`#18` / `#21`):** Branch protection on `main` must still be confirmed/enabled by the repository owner (`Snnn3`) so only authorized team workflows/PRs land on `main`.
- **Additional secret for app startup (`#22`):** Production mode requires a non-default `JWT_SECRET` of at least 32 characters (`server/src/config/environment.ts`). Store it in `s7c512824-app-secret-1`; the release workflow maps that Secret Manager reference to `JWT_SECRET` on the service. Never store the value in GitHub variables or Git.

Before changing either Cloud Run resource, `deploy/release.sh` reads its configuration and stops unless the assigned Cloud SQL connection and runtime service account are still attached. It does not print the configuration, which may contain secret references. The update commands change only the image, migration command and database secret, plus the service's `NODE_ENV`, port and required secret mappings; other portal settings are preserved.
