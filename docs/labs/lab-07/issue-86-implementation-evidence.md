# Lab 7 Issue #86 — Implementation and Verification Record

**Issue:** [#86 — Implement and test published survey metadata edits](https://github.com/Snnn3/SurveyHub/issues/86)
**Contract:** [Issue #85 reviewed contract](issue-85-contract-review.md)
**Target branch:** `lab-7-staging`
**Feature branch:** `feature/86-published-survey-metadata`
**Pull request:** [#91 — Allow owners to edit published survey metadata](https://github.com/Snnn3/SurveyHub/pull/91) (open; review requested from Snnn3; no CI statuses reported when opened)
**Status:** PR review fixes are implemented and locally verified; replies and re-review are pending.

## Baseline and contract follow-up

- Pre-change source commit: `f1e6e7ce15d36ce944e5edae9e2ffe161750e68c` (PR #89 merged into `lab-7-staging`).
- Contract follow-up commit: `d26326c6b0190e20641a7429939296b8eda00def`.
- RED test commit: `48b9080d2e2ca8bae7e3d06f6879a73181293ccd`.
- Implementation commit: `2cdd841bd31642f97d61ed56bf8bd37ff9be84dd`.
- The accepted contract review and merge disposition are recorded in the linked Issue #85 review.
- Before behavior changes, the Issue #85 P3 normalization note was resolved: metadata descriptions
  are preserved as submitted, measured against the 2,000-character limit without trimming, and
  cleared by `null` or an empty string. A padded-description test is part of STS-LAB7-02.
- No database migration is planned; `surveys.title` and `surveys.description` already exist.

## Implementation and verification plan

| Acceptance criterion | Planned implementation | Verification |
|---|---|---|
| LAB7-AC-01 | Add owner-only `PATCH /api/surveys/:id/metadata` and an owner-facing Edit details page for PUBLISHED surveys. | STS-LAB7-01 checks API persistence, respondent form visibility and response preservation; STS-LAB7-06 checks UI edit, reload and respondent visibility. |
| LAB7-AC-02 | Strict metadata-only schema; trim title, preserve description, support clearing and one-field updates. | STS-LAB7-02 checks 120/121 title, 2,000/2,001 description, blank/padded title, padded description, clear and omitted-field cases. |
| LAB7-AC-03 | Lock the survey row, recheck owner and PUBLISHED state inside the write transaction, and update only supplied metadata fields. | STS-LAB7-01/03 compare questions/options, answer rows, response count and lifecycle snapshot around successful and rejected requests. |
| LAB7-AC-04 | Keep role and ownership guards, reject DRAFT/CLOSED metadata edits, and preserve full draft editing and published/closed structural locks. | STS-LAB7-04/05 check roles, lifecycle regressions and concurrent close/metadata writes; existing Sprint 1 lifecycle tests remain in scope. |

## Test and build evidence

| Stage | Source SHA | Command / test IDs | Result |
|---|---|---|---|
| RED on pre-change behavior | `f1e6e7ce15d36ce944e5edae9e2ffe161750e68c` (application code); tests were added after docs commit `d26326c6b0190e20641a7429939296b8eda00def` | `npm test --prefix server -- --runTestsByPath tests/survey-lifecycle.test.ts -t 'STS-LAB7-'`; STS-LAB7-01..05 | **RED**, as expected: 1 suite failed; 5 failed, 18 skipped. All five new metadata cases received 404 because the route did not exist. Raw output: [issue-86-red-all.txt](evidence/issue-86-red-all.txt). |
| GREEN after implementation | `2cdd841bd31642f97d61ed56bf8bd37ff9be84dd` | `npm test --prefix server -- --runTestsByPath tests/survey-lifecycle.test.ts -t 'STS-LAB7-'`; STS-LAB7-01..05 | **PASS**: 1 suite passed; 5 passed, 18 skipped. Raw output: [issue-86-green-api.txt](evidence/issue-86-green-api.txt). |
| Adjacent regression | `2cdd841bd31642f97d61ed56bf8bd37ff9be84dd` | `npm test --prefix server`; STS-F02-01..11, STS-F03-01..10, STS-F04-01..04, STS-SEC-01/02, auth, unit and health suites | **PASS**: 8 suites passed; 74 passed, 0 skipped. Existing draft editing/deletion, published/closed structural locks, submission, receipts, security and summaries passed. Raw output: [issue-86-server-regression.txt](evidence/issue-86-server-regression.txt). |
| UI E2E | `2cdd841bd31642f97d61ed56bf8bd37ff9be84dd` | `npx playwright test --grep 'STS-LAB7-06'`; `npx playwright test` | **PASS**: focused STS-LAB7-06 1/1; full browser file 3/3 including STS-E2E-01/02. Raw outputs: [focused](evidence/issue-86-e2e.txt), [full regression](evidence/issue-86-e2e-regression.txt). |
| Client/server build and type checks | `2cdd841bd31642f97d61ed56bf8bd37ff9be84dd` | `npm run typecheck`; `npm run build` | **PASS**: both type checks and the client/server production build completed. Outputs: [typecheck](evidence/issue-86-typecheck.txt), [build](evidence/issue-86-build.txt). |

The implementation-stage commands above ran against a disposable local PostgreSQL `surveyhub_test`
database. No deployment or production data was used. Review-fix checks are recorded below.

## PR #91 review follow-up

Based on reviewer feedback on PR head `c336ba2413bc24e1a608e4c6c5082f22a92b5ea7`:

- The title and description controls are disabled during a pending save, so the response handler
  cannot overwrite edits made after submission. STS-LAB7-06 now delays the metadata request and
  asserts both controls are disabled while it is pending.
- STS-LAB7-05a/b now hold the survey row lock and queue the requests in a known order. The close-first
  case asserts metadata returns `400 SURVEY_NOT_EDITABLE` and preserves metadata, structure and
  response data. The metadata-first case confirms the edit completes before close.
- Corrected the STS-LAB7-04 mapping: its tests cover metadata role/state behavior, while existing
  STS-F02-04/05/09/10 remain the adjacent regression coverage for structural edits and deletes.
- Corrected the matching LAB7-AC-04 row in `docs/traceability.md` to distinguish new tests from
  adjacent regressions.

| Review follow-up check | Result | Captured output |
|---|---|---|
| Focused STS-LAB7-05 lock-order tests | **PASS**: 2 passed, 22 skipped; both lock orders are deterministic. | [issue-86-review-race.txt](evidence/issue-86-review-race.txt) |
| Full server regression | **PASS**: 8 suites, 75 tests passed. | [issue-86-review-server-regression.txt](evidence/issue-86-review-server-regression.txt) |
| `npm run typecheck` | **PASS**: server and client. | [issue-86-review-typecheck.txt](evidence/issue-86-review-typecheck.txt) |
| `npm run build` | **PASS**: client and server production builds. | [issue-86-review-build.txt](evidence/issue-86-review-build.txt) |
| `npx playwright test` | **PASS**: all 3 browser flows, including the pending-save assertion in STS-LAB7-06. | [issue-86-review-e2e.txt](evidence/issue-86-review-e2e.txt) |

All follow-up checks also ran against the disposable local PostgreSQL `surveyhub_test` database.
The PR remains open and unmerged pending reviewer re-review.
