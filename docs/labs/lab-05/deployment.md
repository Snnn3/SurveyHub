# Lab 5 deployment and environment configuration

**Scope:** Issue [#19](https://github.com/Snnn3/SurveyHub/issues/19), consolidated with [#20](https://github.com/Snnn3/SurveyHub/issues/20). This documents configuration and reproducible local verification; it does not claim the application has been deployed to Cloud Run.

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
