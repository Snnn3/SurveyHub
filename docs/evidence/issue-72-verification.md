# Issue #72 verification

Run the database checks against a disposable PostgreSQL 16 container bound to `127.0.0.1:54520`, using a temporary `surveyhub_test` database on tmpfs. The existing Compose app database and its volume were not used. E2E resets only this disposable test database.

```powershell
docker run --detach --name surveyhub-issue72-testdb-20261127 `
  --tmpfs /var/lib/postgresql/data:rw,size=512m `
  --env POSTGRES_HOST_AUTH_METHOD=trust `
  --env POSTGRES_DB=surveyhub_test `
  --publish 127.0.0.1:54520:5432 postgres:16-alpine

$env:NODE_ENV = 'test'
$env:DATABASE_URL_TEST = 'postgresql://postgres:issue72testpass@127.0.0.1:54520/surveyhub_test?schema=public'

npm test --prefix server -- --runTestsByPath tests/response-submission-sprint2.integration.test.ts
npm test
npm run typecheck
npm run build
npm run test:components --prefix client
npm run test:e2e
```

`issue72testpass` is a throwaway local test URL value; PostgreSQL uses trust authentication only inside the loopback-bound temporary container. The value is not a project credential and is not stored in an environment file.

| Check | Actual result | Output |
|---|---|---|
| Pre-implementation Issue #72 integration baseline | 1 suite; 4 failed, 2 passed, exposing the missing F-06/F-07/F-05 transaction behavior | [RED run](issue-72-red-rerun-2026-11-27.txt) |
| Issue #72 API/database integration | 1 suite; 11 passed, including all seven answer types, identified/anonymous privacy, duplicate race, rollback, zero-write rejections, and before/at/after deadline | [Focused run](issue-72-focused-green.txt) |
| Full Jest regression | 15 suites; 121 tests passed | [Full Jest output](issue-72-full-jest.txt) |
| Typecheck | Server and client passed | [Typecheck output](issue-72-typecheck.txt) |
| Production build | Client and server build exited 0 | [Build output](issue-72-build.txt) |
| Client component tests | 9 passed | [Component output](issue-72-client-components.txt) |
| Playwright E2E | 7 passed | [E2E output](issue-72-e2e.txt) |

The concurrent duplicate test returned one `201` and one `409` without a transaction-acquisition timeout, so `transactionOptions.maxWait` was not changed.
