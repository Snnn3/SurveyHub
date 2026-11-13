# Part F: Sprint 1 Verification, Demonstration Scenarios and Engineering Process Evidence

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
**Course:** CPE 334 Software Engineering, Semester 1/2026
**Deliverable:** Project Deliverable 1 — Part F (20 points)
**Document status:** Verification guide v5 with Issue #7 evidence update dated 13 November 2026
**Related documents:** Part E (contracts and test specifications), Part C (design), Part B (traceability)

> **Status: Issue #7 worktree evidence captured on 13 November 2026.**
> The release results from PR #17 are historical PR-reported evidence. The commands below were run
> from the Issue #7 worktree based on `00494b26df89892066c2680e0a03e0cc03c905a7`, using an
> isolated, loopback-only PostgreSQL 18.1 cluster and `surveyhub_test`. Typecheck/build passed;
> `npm test` passed 7 suites / 60 tests; the focused security matrix passed 4 tests; both E2E
> journeys passed; and the 50-request benchmark measured p95 at 13.249 ms. These are worktree
> results, not a separate run on the release tag. Manual demo scenarios not run here remain PLANNED.
>
> The previous draft contained invented test counts, invented terminal logs, invented pull requests
> and commit SHAs that never existed in the repository. All of that has been removed. If a check has
> not been run, it stays `PLANNED`. If a check failed, it is recorded as `FAILED`, not hidden.

### Issue #7 evidence run — 13 November 2026

| Check | Command | Actual result | Evidence |
|---|---|---|---|
| Typecheck | `npm run typecheck` | Passed for server and client | `docs/evidence/static-checks-run.txt` |
| Production build | `npm run build` | Passed for client and server | `docs/evidence/build-run.txt` |
| E2E discovery | `npx playwright test --list` | Found the two specified E2E tests; this does not execute them | `e2e/sprint1-survey-flow.spec.ts` |
| E2E run (earlier verification) | `npm run test:e2e` | Production build passed; both STS-E2E journeys passed (2/2) against a clean seeded test database before the local-database guard was added | `docs/evidence/e2e-run.txt` |
| E2E reset safety (PR review follow-up) | `node e2e/start-server.test.js` | Passed for a remote authority host, a remote `host=` override, and an unsupported database scheme; none invoked the reset command | `docs/evidence/e2e-guard-review-run.txt` |
| Latest E2E rerun (PR review follow-up) | `npm run test:e2e` | Guard and production build passed; Playwright did not start because the local PostgreSQL ports were unreachable and Prisma could not run the reset | `docs/evidence/e2e-guard-review-run.txt` |
| Security matrix | `npm run test --prefix server -- --runTestsByPath tests/security-matrix.test.ts` | Passed 1 suite / 4 tests; covered 14 protected route registrations, missing/malformed/expired tokens, wrong roles, non-owner access, private-data absence, and unchanged database state | `docs/evidence/security-matrix-run.txt` |
| Full server suite | `npm test` | Passed 7 suites / 60 tests, including bcrypt cost 10 and logout revocation assertions | `docs/evidence/npm-test-run.txt` |
| Performance | `npm run bench:read --prefix server` | 50 sequential authenticated form reads; p50 7.693 ms, p95 13.249 ms, p99 22.422 ms; p95 below the 300 ms target | `docs/evidence/nfr-perf-01-run.txt`, `docs/evidence/nfr-perf-01.json` |
| LaTeX report | `xelatex -interaction=nonstopmode -halt-on-error -file-line-error Deliverable_1.tex` (final two passes) | Both final passes exited 0; final PDF has 76 pages. Pages 64–76 were rendered; updated evidence pages were inspected with no clipping or overlap | `docs/evidence/report-compile-run.txt`, `docs/evidence/deliverable-1/Deliverable_1.pdf` |
| Issue #5 TDD provenance | Git history plus Issue #5 comments | Corrected red/green summaries exist in the issue/chat record; neither run has a provable SHA or separately archived raw log | See §5 below and the report source |

Environment: Node `v24.14.1`; PostgreSQL `18.1` on Windows `10.0.26200 x64`; CPU
`Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz`; database `surveyhub_test` bound to loopback port
`15432`. Sprint 1 has no CI; no CI gap is reported.

---

## 1. Reproduction Instructions

These instructions must work from a clean clone on a machine that has never run the project. They
are part of the assessment: the TA may follow them exactly.

### 1.1 Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Docker Engine/Desktop | Compose v2 or later; required for the Sprint 1 container path | `docker --version` and `docker compose version` |
| Git | Any recent version | `git --version` |
| Node.js and npm | Node.js 20 LTS or later and compatible npm; needed only for host-side development or tests | `node --version`; `npm --version` |
| PostgreSQL client | Optional with Compose; needed only for direct local-database checks | `psql --version` |

### 1.2 Repository and release

| Field | Value |
|---|---|
| Repository | `https://github.com/Snnn3/SurveyHub` |
| Default branch | `main` |
| Release branch | `sprint-1-staging` → release PR → `main` |
| Release tag | `v0.1.0-sprint1` |
| Release commit SHA | `<fill with the full 40-character SHA after the tag exists>` |
| Assessed date | `<fill with the date the evidence below was captured>` |

Do not fill the SHA from memory or from a planning document. Run `git rev-parse v0.1.0-sprint1` after
tagging and copy the output.

### 1.3 Setup commands

```bash
# 1. Clone and check out the release tag
git clone https://github.com/Snnn3/SurveyHub.git
cd SurveyHub
git checkout tags/v0.1.0-sprint1 -b verify-sprint1

# 2. Confirm the commit being assessed
git rev-parse HEAD

# 3. Build the app and start PostgreSQL
docker compose build app
docker compose up -d db

# 4. Apply migrations and load the reproducible seed
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:seed

# 5. Start the application and check service health
docker compose up -d app
docker compose ps
curl http://localhost:4000/api/health
```

The Compose database uses a named volume for development data. Fresh database initialization must also create the separate `surveyhub_test` database, and the test runner must use it. Never point automated tests at the development database. If using the
host-side test path, install its dependencies and follow the exact commands in the root README. That
README is authoritative if script names change during Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2).

The Jest global setup applies migrations to `DATABASE_URL_TEST` before the test run, so the test
database does not need a separate manual migration step.

### 1.4 Test commands

```bash
# Unit and API/database integration tests
npm test

# One suite only
npm test --prefix server -- tests/auth.test.ts

# End-to-end tests (requires the app to be built)
npm run test:e2e
```

### 1.5 Seeded demo accounts

All demo passwords are `Password123!`. These are synthetic course accounts, not real people.

| Role | Email | Purpose in verification |
|---|---|---|
| `SURVEY_OWNER` | `owner1@survey.local` | Main owner; creates, publishes and closes surveys; views summaries |
| `SURVEY_OWNER` | `owner2@survey.local` | Ownership-boundary tests; must not see owner1's data |
| `RESPONDENT` | `resp1@survey.local` | Normal submission, duplicate submission, receipt retrieval |
| `RESPONDENT` | `resp2@survey.local` | Second respondent; cross-response privacy test |

### 1.6 Reproduction checks

| Check | Command or action | Expected | Result |
|---|---|---|---|
| Clone succeeds | `git clone …` | Repository cloned, tag present | `<PASS/FAIL>` |
| Install succeeds | `npm install` | Exit code 0 | `<PASS/FAIL>` |
| Migration applies from empty database | `npm run db:migrate` | Exit code 0; all tables created | `<PASS/FAIL>` |
| Seed is repeatable | `npm run db:seed` twice | Second run exits 0 with no duplicate users | `<PASS/FAIL>` |
| Build succeeds | `npm run build` | Exit code 0 | `<PASS/FAIL>` |
| App starts | `npm run dev` | Client and API reachable | `<PASS/FAIL>` |
| Compose starts | After migration and seed, `docker compose up -d --build app` | App waits for healthy PostgreSQL; `/api/health` succeeds | `<PASS/FAIL>` |
| Database survives container restart | Stop/start without removing the named volume, then read persisted data | Data remains available | `<PASS/FAIL>` |
| Test database isolation | Inspect test configuration and test run | Uses `surveyhub_test`, not the development database | `<PASS/FAIL>` |

---

## 2. Demonstration Scenarios

Four scenarios are required. Each must be captured against the release commit, with the browser and
terminal visible where relevant. Screenshots alone are not proof of a backend rule; each authorization
and rejection scenario must also show an API response that demonstrates the server decision.

**Shared fields for every scenario**

| Field | Value |
|---|---|
| Release commit | `<full SHA>` |
| Version | `v0.1.0-sprint1` |
| Date and time captured | `<ISO 8601>` |
| Executed by | `<student name and GitHub handle>` |
| Environment | `<OS, Node version, PostgreSQL version, browser>` |

---

### Scenario 1: Normal owner → respondent → summary journey

| Field | Content |
|---|---|
| Feature / AC | F-02, F-03, F-04 / AC-F02-02, AC-F02-03, AC-F02-06, AC-F03-01, AC-F03-02, AC-F03-03, AC-F03-10, AC-F04-01 |
| Roles | `SURVEY_OWNER` (owner1), then `RESPONDENT` (resp1) |
| Starting condition | Seed applied. No survey named "CPE 334 Midterm Feedback 2026" exists. resp1 has not submitted to it. |
| Result status | **PLANNED** |

**Steps**

1. Log in as `owner1@survey.local` and open `/owner/surveys`.
2. Create a survey titled "CPE 334 Midterm Feedback 2026" with:
   - one required single-choice question: "How satisfied are you with the course?" with options
     "Very satisfied", "Neutral", "Unsatisfied";
   - one optional short-text question: "What should improve?".
3. Save the draft, reopen it, and confirm the title, questions and options persisted.
4. Publish the survey. Confirm the status changes to `PUBLISHED`.
5. Log out and log in as `resp1@survey.local`.
6. Open `/surveys`, open the survey, select "Very satisfied", enter a short comment, and submit.
7. Confirm the confirmation screen shows a response id and submission time.
8. Reload the confirmation page, or open `/surveys/:id/confirmation/:responseId`, and confirm the
   same receipt is retrieved from the API.
9. Log out and log in again as `owner1@survey.local`. Open the summary page.
10. Restart the API process and reload the summary page. Confirm the same data is still shown.

**Expected result**

- The survey is persisted as `DRAFT`, then `PUBLISHED`.
- The response is accepted with `201` and stored in PostgreSQL.
- The receipt survives a reload and an API restart.
- The summary shows `totalResponses = 1`, "Very satisfied" with count 1 and percentage 100, and the
  text answer.
- No respondent identity appears in the summary payload.

**Actual result**

`<Describe what actually happened. Do not write "as expected" without stating the observed values.>`

**Evidence to capture**

| ID | Evidence | What it must show |
|---|---|---|
| Fig-1.1 | Owner survey list after publishing | Title, `PUBLISHED` badge, actions for a published survey |
| Fig-1.2 | Respondent form with answers entered | Both question types, required marker, selected option |
| Fig-1.3 | Confirmation screen | Response id and submission timestamp |
| Fig-1.4 | Receipt after reload | The persisted receipt, not client-only state |
| Fig-1.5 | Summary page | Total 1, 100% for the selected option, text answer |
| Fig-1.6 | Terminal or API response for `GET /api/surveys/:id/summary` | JSON envelope and no identity fields |

---

### Scenario 2: Business-rule rejections

| Field | Content |
|---|---|
| Feature / AC | F-03 / AC-F03-04 (BR-01), AC-F03-05 (BR-02), AC-F03-06 (BR-03) |
| Roles | `RESPONDENT` (resp1, resp2), `SURVEY_OWNER` (owner1) |
| Starting condition | Scenario 1 completed: resp1 has one response to the published survey. |
| Result status | **PLANNED** |

**Steps**

1. Log in as `resp1@survey.local`. Attempt to open the survey form again or submit the same survey a
   second time through the UI.
2. Send the same second submission with `curl` or an API client, so the rejection is proven at the
   API level, not only by a disabled button.
3. As `owner1@survey.local`, close the survey.
4. Log in as `resp2@survey.local` and submit to the closed survey.
5. As `owner1`, create a second draft with a required question, then submit to it as a respondent.
6. Submit a payload that omits a required answer, and a payload with an invalid option id or a text
   value over 2,000 characters.

**Expected result**

| Case | Expected |
|---|---|
| 2.1 Duplicate submission | `409 DUPLICATE_SUBMISSION`; response count for resp1 stays 1 |
| 2.2 Closed survey | `400 SURVEY_NOT_ACCEPTING_RESPONSES` |
| 2.3 Draft survey | `400 SURVEY_NOT_ACCEPTING_RESPONSES` |
| 2.4 Missing required answer | `400 MISSING_REQUIRED_QUESTIONS` with the missing question id |
| 2.5 Invalid answer | `400 INVALID_ANSWER`; nothing stored |
| 2.6 Concurrent duplicate | Two simultaneous submissions produce exactly one `201` and one `409` |

**Actual result**

`<Record the status code, error code and database count for each case.>`

**Evidence to capture**

| ID | Evidence | What it must show |
|---|---|---|
| Fig-2.1 | UI error banner for duplicate submission | 409 and the message |
| Fig-2.2 | API response for the duplicate request | Status 409 and `DUPLICATE_SUBMISSION` |
| Fig-2.3 | Database count before and after | Exactly one response and one claim for resp1 |
| Fig-2.4 | API response for the closed survey | Status 400 and `SURVEY_NOT_ACCEPTING_RESPONSES` |
| Fig-2.5 | API responses for missing/invalid answers | `MISSING_REQUIRED_QUESTIONS` or `INVALID_ANSWER` |
| Fig-2.6 | Concurrency test output | One 201 and one 409, no partial rows |

---

### Scenario 3: Authorization and cross-response privacy

| Field | Content |
|---|---|
| Feature / AC | F-01, F-02, F-03, F-04 / AC-SEC-01, AC-SEC-02, AC-F02-09, AC-F03-08, AC-F03-09, AC-F04-02, AC-F04-03 |
| Roles | `RESPONDENT` (resp1, resp2), `SURVEY_OWNER` (owner1, owner2), unauthenticated |
| Starting condition | resp1 has a response id; owner1 owns the survey; owner2 owns a different survey. |
| Result status | **PLANNED** |

**Steps and expected result**

| # | Actor | Action | Expected |
|---|---|---|---|
| 3.1 | No token | `GET /api/surveys` | `401 TOKEN_REQUIRED` |
| 3.2 | No token | `GET /api/surveys/:id/summary` | `401 TOKEN_REQUIRED` |
| 3.3 | resp1 | `GET /api/surveys` (owner route) | `403 FORBIDDEN_ROLE` |
| 3.4 | resp1 | `GET /api/surveys/:id/summary` | `403 FORBIDDEN_ROLE` |
| 3.5 | resp1 | Open `/owner/surveys` in the browser | Access-denied page; no owner data rendered |
| 3.6 | owner1 | Submit a response to the published survey | `403 FORBIDDEN_ROLE`; no response stored |
| 3.7 | owner2 | `GET`/`PUT`/`DELETE` owner1's survey | `403 FORBIDDEN_OWNERSHIP`; data unchanged |
| 3.8 | owner2 | `GET /api/surveys/:id/summary` for owner1's survey | `403 FORBIDDEN_OWNERSHIP`; no statistics |
| 3.9 | resp2 | `GET /api/surveys/:id/responses/:resp1ResponseId` | `403 FORBIDDEN_CROSS_RESPONSE_ACCESS`; no answer data |

**Actual result**

`<Record the status and error code for each row. State explicitly that no protected data appeared in the body.>`

**Evidence to capture**

| ID | Evidence |
|---|---|
| Fig-3.1 | Browser access-denied page for a respondent opening an owner route |
| Fig-3.2 | API responses for 3.1 and 3.2 (401) |
| Fig-3.3 | API responses for 3.3 and 3.4 (403 `FORBIDDEN_ROLE`) |
| Fig-3.4 | API response for 3.6 (owner submitting) |
| Fig-3.5 | API responses for 3.7 and 3.8 (ownership) |
| Fig-3.6 | API response for 3.9 (cross-response), showing the body contains no answers |

The 403 evidence must come from the API, because a hidden or disabled UI control does not prove that
the backend enforces the rule.

---

### Scenario 4: Authentication and session lifecycle

| Field | Content |
|---|---|
| Feature / AC | F-01 / AC-F01-01, AC-F01-02, AC-F01-03, AC-F01-04, AC-F01-05, AC-F01-06 |
| Roles | All |
| Starting condition | User is logged out at `/login`. |
| Result status | **PLANNED** |

**Steps**

1. Enter `owner1@survey.local` with a wrong password and submit.
2. Enter the correct password and submit.
3. Confirm the navbar shows the correct full name and role.
4. Copy the token from the browser storage (or obtain one through the login API).
5. Log out.
6. Reuse the copied token on `GET /api/auth/me`.

**Expected result**

| Case | Expected |
|---|---|
| Wrong password | `401 INVALID_CREDENTIALS`; no token stored |
| Correct password | `200`; token and user returned; redirect by role |
| `/api/auth/me` | Correct id, email, full name and role; no `passwordHash` |
| Logout | `200`; `tokenVersion` incremented by 1 |
| Reused pre-logout token | `401 TOKEN_REVOKED` |

**Actual result**

`<Record the observed status codes and the tokenVersion before and after logout.>`

**Evidence to capture**

| ID | Evidence |
|---|---|
| Fig-4.1 | Login form with the invalid-credentials banner |
| Fig-4.2 | Successful login and role-correct landing page |
| Fig-4.3 | `GET /api/auth/me` response |
| Fig-4.4 | `token_version` in the database before and after logout |
| Fig-4.5 | `401 TOKEN_REVOKED` when the old token is reused |

---

## 3. Automated Test Evidence

### 3.1 Planned test inventory

The planned suite counts are maintained in the [Part E test count summary](sprints/sprint-1/sts.md#10-test-count-summary).
Record the actual run exactly below, including any tests added, failed or skipped.

### 3.2 Execution record

| Field | Value |
|---|---|
| Command | `npm test`; focused security matrix; `npm run test:e2e` |
| Base | `00494b26df89892066c2680e0a03e0cc03c905a7` (`sprint-1-staging`); Issue #7 worktree, not the release tag |
| Test database | Loopback-only PostgreSQL 18.1; `surveyhub_test` |
| Version | Node `v24.14.1`; Windows `10.0.26200 x64` |
| Date | 2026-11-13 |
| Unit/integration result | `npm test`: 7 suites / 60 tests passed; focused security matrix: 1 suite / 4 tests passed |
| E2E result | `npm run test:e2e`: 2 journeys passed against a clean seeded test database |
| Total time | Jest reported 84.28 s; final E2E run reported 22.6 s |
| Exit code | `0` for all three commands |

The complete outputs are saved at `docs/evidence/npm-test-run.txt`,
`docs/evidence/security-matrix-run.txt`, and `docs/evidence/e2e-run.txt`.

```text
Test Suites: 7 passed, 7 total
Tests:       60 passed, 60 total
Snapshots:   0 total
Time:        84.28 s
Ran all test suites.
```

```text
Running 2 tests using 1 worker
2 passed (22.6s)
```

### 3.3 Acceptance-criteria-to-test mapping

Statuses below reflect the named checks in the saved test output. The database-restart row remains
`PLANNED` because no restart check was run in this evidence update. `PASS`, `FAILED`, `SKIPPED` and
`BLOCKED` are the valid outcomes once execution starts.

| AC | Test ID | Level | File | Result | Evidence |
|---|---|---|---|---|---|
| AC-F01-01 | STS-F01-01 | Integration | `server/tests/auth.test.ts` | PASS: auth suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F01-02 | STS-F01-02 | Integration | `server/tests/auth.test.ts` | PASS: auth suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F01-03 | STS-F01-03 | Integration | `server/tests/auth.test.ts` | PASS: auth suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F01-04 | STS-F01-04 | Integration/DB | `server/tests/auth.test.ts` | PASS: auth suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F01-05 | STS-F01-05 | Integration | `server/tests/auth.test.ts` | PASS: logout/revocation test passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F01-06 | STS-F01-06 | Integration/DB | `server/tests/auth.test.ts` | PASS: auth suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-01 | STS-F02-01 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-02 | STS-F02-02 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-03 | STS-F02-03 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-04 | STS-F02-04 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-05 | STS-F02-05 | Integration/DB | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-06 | STS-F02-06 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-07 | STS-F02-07 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-08 | STS-F02-08 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-09 | STS-F02-09 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-10 | STS-F02-10 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F02-11 | STS-F02-11 | Integration | `server/tests/survey-lifecycle.test.ts` | PASS: lifecycle suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-01 | STS-F03-01 | Integration | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-02 | STS-F03-02 | Integration | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-03 | STS-F03-03 | Integration/DB | `server/tests/response-submission.test.ts` | PASS: response, answers, option, and claim persisted atomically | `docs/evidence/npm-test-run.txt` |
| AC-F03-04 | STS-F03-04 | Integration (TDD) | `server/tests/response-submission.test.ts` | PASS: current regression passed; historical red/green SHAs remain unavailable (see §5) | `docs/evidence/npm-test-run.txt` |
| AC-F03-05 | STS-F03-05 | Integration | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-06 | STS-F03-06 | Integration | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-07 | STS-F03-07 | Integration | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-08 | STS-F03-08 | Integration (privacy) | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-09 | STS-F03-09 | Integration (role) | `server/tests/response-submission.test.ts` | PASS: response suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F03-10 | STS-F03-10 | Integration | `server/tests/response-submission.test.ts` | PASS: receipt retrieval test passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F04-01 | STS-F04-01 | Integration/DB | `server/tests/survey-summary.test.ts` | PASS: summary suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F04-02 | STS-F04-02 | Integration (role) | `server/tests/survey-summary.test.ts` | PASS: summary suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F04-03 | STS-F04-03 | Integration (ownership) | `server/tests/survey-summary.test.ts` | PASS: summary suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-F04-04 | STS-F04-04 | Integration | `server/tests/survey-summary.test.ts` | PASS: summary suite passed in full run | `docs/evidence/npm-test-run.txt` |
| AC-SEC-01 | STS-SEC-01 | Integration (route matrix) | `server/tests/security-matrix.test.ts` | PASS: 14 protected routes reject missing, malformed, and expired tokens with 401 and no data | `docs/evidence/security-matrix-run.txt` |
| AC-SEC-02 | STS-SEC-02 | Integration (role matrix) | `server/tests/security-matrix.test.ts` | PASS: wrong-role and non-owner calls return 403 with no private data or database changes | `docs/evidence/security-matrix-run.txt` |
| AC-PERF-01 | Benchmark `benchmark-read.ts` | Measurement | `server/scripts/benchmark-read.ts` | PASS: 50 requests; p95 13.249 ms (<300 ms) | `docs/evidence/nfr-perf-01.json` |
| AC-DATA-01 | STS-F03-03 + restart check | Integration + manual | `server/tests/response-submission.test.ts` | PLANNED: STS-F03-03 passed; restart survival was not checked | `docs/evidence/npm-test-run.txt` |
| STS-F03-03 persistence | STS-F03-03 | Integration/DB | `server/tests/response-submission.test.ts` | PASS: response, answers, option, and claim persisted atomically | `docs/evidence/npm-test-run.txt` |
| BR-06 structure | STS-U-01, STS-U-02 | Unit | `server/tests/unit/rules.test.ts` | PASS: 8 unit tests passed in full run | `docs/evidence/npm-test-run.txt` |
| BR-03 validation | STS-U-03, STS-U-04 | Unit | `server/tests/unit/rules.test.ts` | PASS: 8 unit tests passed in full run | `docs/evidence/npm-test-run.txt` |
| Percentage logic | STS-U-05 | Unit | `server/tests/unit/rules.test.ts` | PASS: 8 unit tests passed in full run | `docs/evidence/npm-test-run.txt` |
| Journey 1 | STS-E2E-01 | E2E | `e2e/sprint1-survey-flow.spec.ts` | PASS: owner creates/publishes; respondent submits and reloads receipt; owner sees 1 response / 100% | `docs/evidence/e2e-run.txt` |
| Journey 2 | STS-E2E-02 | E2E | `e2e/sprint1-survey-flow.spec.ts` | PASS: duplicate 409, cross-response access 403 without answer data, logged-out token 401 `TOKEN_REVOKED` | `docs/evidence/e2e-run.txt` |

### 3.4 Non-functional verification plan

| NFR | Target | Method | Observed value | Result |
|---|---|---|---|---|
| NFR-SEC-01 | Every protected route rejects missing, malformed and expired tokens with 401 and no data | `STS-SEC-01` dynamically enumerates API route registrations and requires only login/health to be public | 14 protected route registrations; all token cases passed with no response data | PASS |
| NFR-SEC-02 | Every forbidden role/ownership operation returns 403 and leaves data unchanged | `STS-SEC-02` role and ownership matrix | Wrong roles and non-owners received 403; snapshots of the test tables were unchanged | PASS |
| NFR-SEC-03 | bcrypt cost 10; no plaintext password or hash in any response | Existing dedicated assertion in `server/tests/auth.test.ts` checks `$2b$10$` | Full suite passed the bcrypt cost/prefix assertion and response privacy checks | PASS |
| NFR-SEC-04 | Logout revokes existing tokens | `STS-F01-05`; old token returns 401 `TOKEN_REVOKED` | Full suite and E2E both passed logout token-revocation checks | PASS |
| NFR-PERF-01 | p95 of `GET /api/surveys/:id/form` < 300 ms over 50 requests on the local development environment | `server/scripts/benchmark-read.ts` writes p50/p95/p99 JSON | Node `v24.14.1`; PostgreSQL `18.1`; 50 requests; p50 7.693 ms / p95 13.249 ms / p99 22.422 ms | PASS |
| NFR-DATA-01 | Foreign keys and unique constraints exist; data survives API and database restart | Inspect migration SQL; `STS-F03-03`; restart check in Scenario 1 | `<record>` | PLANNED |
| NFR-PRIV-01 | Anonymous responses carry no identity link | Deferred to Sprint 2 with `STS-PRIV-01` | — | DEFERRED |

The performance number must come from the benchmark output. The duration of a test run is not a
latency measurement and must not be reported as one.

**Benchmark record**

| Field | Value |
|---|---|
| Command | `npm run bench:read --prefix server` |
| Base | `00494b26df89892066c2680e0a03e0cc03c905a7` (`sprint-1-staging`); this is a worktree benchmark, not release-tag evidence |
| Target requests | 50 sequential reads |
| Completed requests | 50 sequential authenticated reads |
| p50 / p95 / p99 | 7.693 ms / 13.249 ms / 22.422 ms |
| Environment | Node `v24.14.1`; PostgreSQL `18.1`; Windows `10.0.26200 x64`; Intel i5-8250U @ 1.60GHz; `surveyhub_test` |
| Result file | `docs/evidence/nfr-perf-01.json` |
| Pass/fail | PASS; p95 is below the 300 ms target |

---

## 4. Required Test Artifacts

Two short excerpts must appear in the report: one domain rule and one access restriction. The code
below is the planned test shape from the Part E contract. After implementation, replace each excerpt
with the version that exists on the release commit and cite its file and line numbers. Do not present
planning code as if it were the executed file.

### 4.1 Domain rule excerpt: BR-01 duplicate submission guard

```typescript
// Planned shape. Replace with the committed version from
// server/tests/response-submission.test.ts and cite the line range.
describe("BR-01 duplicate submission", () => {
  it("rejects a second submission and stores exactly one response", async () => {
    const first = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${resp1Token}`)
      .send({
        answers: [
          { questionId: choiceQuestionId, selectedOptionIds: [satisfiedOptionId] },
        ],
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${resp1Token}`)
      .send({
        answers: [
          { questionId: choiceQuestionId, selectedOptionIds: [satisfiedOptionId] },
        ],
      });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("DUPLICATE_SUBMISSION");

    const claims = await prisma.responseClaim.count({
      where: { surveyId, userId: resp1UserId },
    });
    const responses = await prisma.surveyResponse.count({
      where: { surveyId, respondentId: resp1UserId },
    });
    expect(claims).toBe(1);
    expect(responses).toBe(1);
  });
});
```

### 4.2 Access restriction excerpt: cross-response privacy

```typescript
// Planned shape. Replace with the committed version from
// server/tests/response-submission.test.ts and cite the line range.
describe("BR-05 cross-response privacy", () => {
  it("does not let one respondent read another respondent's receipt", async () => {
    const res = await request(app)
      .get(`/api/surveys/${surveyId}/responses/${resp2ResponseId}`)
      .set("Authorization", `Bearer ${resp1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN_CROSS_RESPONSE_ACCESS");
    expect(res.body.data).toBeUndefined();
  });

  it("does not let a respondent read the owner summary", async () => {
    const res = await request(app)
      .get(`/api/surveys/${surveyId}/summary`)
      .set("Authorization", `Bearer ${resp1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });
});
```

---

## 5. TDD Evidence for BR-01

BR-01 is the required TDD demonstration because it has a real concurrency risk and a database
constraint, not only a service check.

### 5.1 Required sequence

| Stage | Commit message pattern | What must be visible |
|---|---|---|
| Contract | `docs(contracts): freeze Sprint 1 F-03 response rules contract` | Contract reviewed in tracked `docs/sprints/sprint-1/f-03.md` and merged before implementation |
| Red | `test(rules): add failing BR-01 duplicate submission test (red)` | Test fails for the expected reason: second submission returns 201 instead of 409 |
| Green | `feat(rules): enforce BR-01 duplicate submission guard (green)` | Same test passes after claim constraint and `P2002` mapping |
| Refactor | `refactor(rules): extract response claim handling` | Test still passes unchanged |

Historical evidence search on 13 November 2026 found no red-stage or green-stage commit SHA in the
reachable Git history. The feature implementation commit `ca501838cb2c0e2579b70eed42ce3baf545d2753`
is not evidence for either test stage and is not assigned to them. [Issue #5's corrected comment](https://github.com/Snnn3/SurveyHub/issues/5#issuecomment-6767760438)
records the expected duplicate-accepted red (`201` instead of `409`) and a passing green summary,
but does not name either SHA or contain a separately archived terminal log. The earlier [Issue #5
comment](https://github.com/Snnn3/SurveyHub/issues/5#issuecomment-6767457565) records a `404` red
run that was replaced because the endpoint did not yet exist. The supplied LaTeX report contains
chat-recovered output excerpts; those excerpts are not raw archived logs. No new controlled TDD
red/green reproduction was run in this update; the passing regression suite does not recreate the
historical database changes used for the red stage.

### 5.2 Red run record

| Field | Value |
|---|---|
| Command | Chat excerpt: `npm test --prefix server -- --runInBand --cacheDirectory .jest-cache --testTimeout=60000 tests/response-submission.test.ts -t "STS-F03-04"` |
| Commit | Unavailable; Issue #5 and Git history do not associate the run with a SHA |
| Failed test | `STS-F03-04`, as reported in Issue #5 and the chat excerpt |
| Expected vs received | Corrected red summary: expected `409`, received `201`; an earlier `404` run was explicitly superseded |
| Failure reason is the intended one | Issue #5 says yes for the corrected red: the duplicate guard was disabled and duplicate indexes were temporarily removed on the test database |

```text
The report's red output is recovered from the project chat, not a raw archived log.
```

### 5.3 Green run record

| Field | Value |
|---|---|
| Command | Chat excerpt: `npm test --prefix server -- --runInBand --cacheDirectory .jest-cache --testTimeout=60000 tests/response-submission.test.ts -t "STS-F03-04"` |
| Commit | Unavailable; Issue #5 and Git history do not associate the run with a SHA |
| Result | Issue #5 and the chat excerpt report the test passed with one `201`, one `409 DUPLICATE_SUBMISSION`, and one response/claim per respondent; raw test totals are not independently archived |

```text
The report's green output is recovered from the project chat, not a raw archived log.
```

If the red stage cannot be reproduced, record that fact. Do not reconstruct a plausible failure log
after the fact.

---

## 6. Engineering Process Evidence

### 6.1 Pull requests

At least two complete chains must be shown: issue → branch → PR → review → merge → staging → release.
Fill each row from GitHub after the event exists. Do not predict PR numbers, reviewers, merge times or SHAs.

| PR | Issue | Feature/workstream | Branch | Author | Reviewer | Substantive review comment (link) | Merged at | Merge commit |
|---|---|---|---|---|---|---|---|---|
| `<#>` | [#1](https://github.com/Snnn3/SurveyHub/issues/1) | Scope and contracts | `docs/1-sprint-1-contracts` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | [#2](https://github.com/Snnn3/SurveyHub/issues/2) | Scaffold, schema, migration, seed and Docker Compose | `feature/2-sprint-1-scaffold-and-docker` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | [#3](https://github.com/Snnn3/SurveyHub/issues/3) | F-01 Authentication and RBAC | `feature/3-f01-auth` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | [#4](https://github.com/Snnn3/SurveyHub/issues/4) | F-02 Survey lifecycle | `feature/4-f02-survey-lifecycle` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | [#5](https://github.com/Snnn3/SurveyHub/issues/5) | F-03 Response rules | `feature/5-f03-response-rules` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | [#6](https://github.com/Snnn3/SurveyHub/issues/6) | F-04 Aggregate summary | `feature/6-f04-summary` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | [#7](https://github.com/Snnn3/SurveyHub/issues/7) | Integration, evidence and release | `feature/7-sprint-1-verification` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |
| `<#>` | Release | `sprint-1-staging` → `main` | `sprint-1-staging` | `<author>` | `<reviewer>` | `<link>` | `<time>` | `<SHA>` |

Review requirements:

- The author does not approve their own PR.
- The review contains at least one specific technical check, question or finding. "LGTM" alone does not count.
- If a required check fails or changes are requested, move the same issue and PR to `Fixing`; fix the same branch, rerun checks and return it to `In review`.
- Capture the reviewer's comment and the author's response.
- Screenshots include the PR number, author, reviewer and merge state.

### 6.2 Planned commit sequence

This sequence describes required work, not completed history. Replace placeholders only with facts from
GitHub and `git log` after they exist. Feature PRs target `sprint-1-staging`; only the approved release PR
targets `main`.

| # | Issue / branch | Stage | Planned commit message | Author | SHA | Date |
|---:|---|---|---|---|---|---|
| 1 | #1 / `docs/1-sprint-1-contracts` | Analyze, plan and version contracts | `docs: define deliverable 1 scope and sprint 1 contracts` | `<author>` | `<SHA>` | `<date>` |
| 2 | #2 / `feature/2-sprint-1-scaffold-and-docker` | Scaffold, schema, migration, seed and Compose | `chore(setup): add app, database and docker compose scaffold` | `<author>` | `<SHA>` | `<date>` |
| 3 | #3 / `feature/3-f01-auth` | F-01 implementation and tests | `feat(auth): add login, me and revocable sessions` | `<author>` | `<SHA>` | `<date>` |
| 4 | #4 / `feature/4-f02-survey-lifecycle` | F-02 implementation and tests | `feat(survey): add draft lifecycle and authoring` | `<author>` | `<SHA>` | `<date>` |
| 5 | #5 / `feature/5-f03-response-rules` | TDD red/green and F-03 implementation | `test(rules): add failing duplicate submission test (red)`; then green fix | `<author>` | `<SHA>` | `<date>` |
| 6 | #6 / `feature/6-f04-summary` | F-04 implementation and tests | `feat(summary): add owner aggregate summary` | `<author>` | `<SHA>` | `<date>` |
| 7 | #7 / `feature/7-sprint-1-verification` | Integration, E2E, evidence and release preparation | `test(e2e): verify critical journeys and capture evidence` | `<author>` | `<SHA>` | `<date>` |
| 8 | Release PR | Staging to main after approval and checks | `release: merge sprint-1-staging and tag v0.1.0-sprint1` | `<author>` | `<SHA>` | `<date>` |

Issue #1 documents are committed under `docs/`; only local reference material in `docs/materials/` is
ignored. Contract scope and acceptance criteria are reviewed before implementation starts on Issue #2.

### 6.3 Contribution record

This table records actual work. It is filled after the release, from GitHub and the team's own records.

| Area | Author(s) | Reviewer(s) | Evidence |
|---|---|---|---|
| Requirements and scope (Part A) | `<names>` | `<names>` | `<commit/issue link>` |
| Traceability (Part B) | `<names>` | `<names>` | `<commit/issue link>` |
| Design (Part C) | `<names>` | `<names>` | `<commit/issue link>` |
| Sprint plan (Part D) | `<names>` | `<names>` | `<commit/issue link>` |
| Contracts (Part E) | `<names>` | `<names>` | `<commit/issue link>` |
| Scaffold, schema, seed | `<names>` | `<names>` | `<PR link>` |
| F-01 Auth & RBAC | `<names>` | `<names>` | `<PR link>` |
| F-02 Survey lifecycle | `<names>` | `<names>` | `<PR link>` |
| F-03 Response rules | `<names>` | `<names>` | `<PR link>` |
| F-04 Aggregate summary | `<names>` | `<names>` | `<PR link>` |
| Client UI | `<names>` | `<names>` | `<PR link>` |
| E2E and release | `<names>` | `<names>` | `<PR link>` |
| Report and evidence | `<names>` | `<names>` | `<commit link>` |

Approximate contribution share must be justified by this evidence, not asserted.

### 6.4 Branch and review rules applied

- Feature branches are created from `sprint-1-staging`, not from `main`.
- Direct commits to `main` are not allowed. The only commit to `main` is the reviewed release merge.
- The release PR is from `sprint-1-staging` to `main` and is tagged `v0.1.0-sprint1`.
- The tag points to the commit that was tested. If a later commit is needed, the tests are re-run and
  the tag is moved only with a recorded reason.
- The full suite must pass on `sprint-1-staging` before the release PR is opened.

---

## 7. Disclosure of Incomplete Work

This section must be truthful at submission time. Replace the placeholders after the final run.

| Item | Status | Detail |
|---|---|---|
| F-05 Anonymous mode | Deferred to Sprint 2 | Schema and claim design exist; no anonymous endpoint in Sprint 1 |
| F-06 Expanded question types | Deferred to Sprint 2; Issue [#9](https://github.com/Snnn3/SurveyHub/issues/9) | Typed answer fields are designed; Sprint 1 UI and validation cover single-choice and short text only |
| F-07 Eligibility allowlist and scheduled close | Deferred to Sprint 2 | `SurveyEligibility` table exists; Sprint 1 treats all respondents as eligible; no date picker |
| F-08 Export, charts, raw-response browser | Deferred to Sprint 3 | Not implemented |
| Docker Compose local environment | Sprint 1, Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2) | In scope; completion and persistence checks remain PLANNED until executed |
| CI/CD automation and GCP deployment | Lab 5 | Not part of Deliverable 1 |
| Deliverable documents | Tracked in Git | Parts A–F live under `docs/` outside the ignored `docs/materials/` local-reference folder. |
| Failed tests | `<list or "none">` | `<test id, reason, impact>` |
| Skipped tests | `<list or "none">` | `<test id, reason>` |
| Known defects | `<list or "none">` | `<description, severity, workaround>` |
| Incomplete acceptance criteria | `<list or "none">` | `<AC id and what is missing>` |

If every Sprint 1 acceptance criterion is not verified, say so here. Partial work disclosed honestly is
not a failure of the deliverable; a false claim of completion is.

---

## 8. AI-Use Declaration

Complete this section with the tools actually used and the work actually reviewed.

- **Tools used:** `<tool name and version, e.g. an AI coding assistant used for drafting>`
- **Used for:** `<e.g. document drafting, Prisma boilerplate, test scaffolding, seed data>`
- **Not used for:** `<e.g. no fabricated evidence; no unreviewed business logic>`
- **Human verification:** Both students reviewed the generated code, understood the logic, ran the
  tests, and can explain the rules and access checks in the demonstration video.
- **Responsibility:** The team is responsible for every line submitted, regardless of how it was
  produced.

---

## 9. Pre-Submission Evidence Checklist

### 9.1 Repository and release

- [ ] `main` contains the release merge and no direct feature commits
- [ ] Tag `v0.1.0-sprint1` exists and points to the tested commit
- [ ] README covers Docker Compose startup, environment, migration, seed, run, test and persistence-check commands
- [ ] `.env.example` contains no real secret
- [ ] `.env` is ignored by Git
- [ ] Seed is repeatable and creates 4 accounts and 3 surveys
- [ ] Test database setup is documented and works from a clean machine
- [ ] Compose waits for a healthy database, uses a named volume and exposes a working `/api/health` check
- [ ] Compose test configuration uses the separate `surveyhub_test` database

### 9.2 Verification

- [ ] `npm test` runs on the release commit and the full output is saved
- [ ] `npm run test:e2e` runs on the release commit and the full output is saved
- [ ] Test counts are copied exactly, including failed and skipped
- [ ] No test is disabled, weakened or commented out to obtain a green run
- [ ] Two real test excerpts are embedded and cited by file and line
- [ ] Real TDD red and green outputs are embedded with both commit SHAs
- [ ] NFR-SEC-01..04 are verified with tests, not assertions
- [ ] NFR-PERF-01 is measured with the benchmark script and p95 is recorded
- [ ] NFR-DATA-01 is verified by migration inspection, persistence test and restart
- [ ] NFR-PRIV-01 is marked DEFERRED, not PASS

### 9.3 Scenarios

- [ ] Scenario 1 captured with persisted data retrieved after reload and restart
- [ ] Scenario 2 captured with API evidence, not only a UI banner
- [ ] Scenario 3 captured with API evidence for 401 and 403, including cross-response privacy
- [ ] Scenario 4 captured with `tokenVersion` before/after and `TOKEN_REVOKED` on the old token
- [ ] Every scenario names the AC IDs, role, starting condition, steps, expected, actual and version
- [ ] No screenshot is reused from another commit or from planning documents

### 9.4 Process

- [ ] At least two issue → branch → PR → review → merge chains are documented
- [ ] Author and reviewer are different people on every PR
- [ ] Review comments are specific and linked
- [ ] Release PR from `sprint-1-staging` to `main` is documented
- [ ] Contribution table matches GitHub history
- [ ] AI-use declaration is complete
- [ ] Incomplete work and failed/skipped tests are disclosed

### 9.5 Document integrity

- [ ] Every `<placeholder>` in this document has been replaced or removed
- [ ] No status remains PLANNED in the submitted report unless the work is genuinely unstarted and
      disclosed
- [ ] No SHA, PR number, screenshot, test count or UAT result was invented
- [ ] Page numbers in the master navigation table match the compiled PDF
- [ ] The compiled PDF is checked once more against the repository at the tagged commit

---

## 10. Final Statement

Sprint 1 is complete for Deliverable 1 only when the release commit, the test run, the demonstration
evidence and this report all describe the same version of the system. Any mismatch means the evidence
is not yet valid. The team must submit what it actually built and verified, with the remaining work
disclosed in section 7.

| Role | Name | Student ID | GitHub | Signature / date |
|---|---|---|---|---|
| Student 1 | Worawut Sereethai | 67070501040 | [@YummieGG](https://github.com/YummieGG) | `<fill>` |
| Student 2 | Chanon Lhumsa-ard | 67070501059 | [@Snnn3](https://github.com/Snnn3) | `<fill>` |
