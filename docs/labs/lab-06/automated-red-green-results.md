# Lab 6 automated RED/GREEN results

**Issue:** [#90](https://github.com/Snnn3/SurveyHub/issues/90)

**Fix:** [PR #75](https://github.com/Snnn3/SurveyHub/pull/75)

**Run date:** 2026-11-28 (Asia/Bangkok)

## Result

The same three focused Jest suites were run against the controlled-exercise source and the fix candidate. All three reported failures reproduced on the exercise source; the same test set passed on the fix candidate.

| Finding | Automated test | RED on exercise `3893332720500badf89a15213c1cc395599f49e4` | GREEN on fix `db8792a21b90e27d55da0df25d8b482e393e8c26` |
|---|---|---|---|
| EX-01: draft description lost after update | `STS-F02-04` in `survey-lifecycle.test.ts` | Failed: expected `Updated Description`, received `null` (`survey-lifecycle.test.ts:235`). | Passed. |
| EX-02: empty summary reports one response | `STS-F04-04` in `survey-summary.test.ts` | Failed: expected `0`, received `1` (`survey-summary.test.ts:196`). | Passed. |
| EX-03: valid required short text rejected | `accepts a valid non-empty answer to a required short-text question` in `response-submission.test.ts` | Failed: expected HTTP `201`, received `400` (`response-submission.test.ts:230`). | Passed. |

**RED totals:** 3 suites failed, 3 tests failed, 33 tests passed, 0 snapshots; command exit code 1.

**GREEN totals:** 3 suites passed, 36 tests passed, 0 snapshots; command exit code 0.

## Test setup and commands

Runs used Node `v26.5.0`, npm `11.17.0`, and an ephemeral PostgreSQL `16.15` container bound to loopback port `49878`, with the isolated database `surveyhub_test`. `NODE_ENV=test`, `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, and `DEMO_USER_PASSWORD` were set to local test-only values. The tests used no shared UAT database or cloud resource. The Jest setup applied migrations and truncated the isolated test tables before each suite; it did not seed demo accounts.

The exact test command for both runs was:

```sh
npm test --prefix server -- --runTestsByPath \
  tests/survey-lifecycle.test.ts \
  tests/survey-summary.test.ts \
  tests/response-submission.test.ts
```

The EX-01 and EX-02 tests already existed at the exercise commit. The EX-03 regression test was added in the fix candidate, so the exact test-only diff from the fix candidate was applied to the disposable RED worktree before running. The worktree remained at the exercise SHA; no commit or branch was changed:

```sh
git diff 3893332720500badf89a15213c1cc395599f49e4 \
  db8792a21b90e27d55da0df25d8b482e393e8c26 -- \
  server/tests/response-submission.test.ts |
  git -C <red-worktree> apply --
```

The full captured Jest output is preserved in [the RED log](evidence-red-green/red-3893332.txt) and [the GREEN log](evidence-red-green/green-db8792a.txt).

Trailing whitespace was removed from the copied output files; test messages and results were not edited.

| Log | SHA-256 |
|---|---|
| `red-3893332.txt` | `be8bf47ef885f94eb1ba71a1a2944b94b4085872b7859b48a4dde118dc4765f6` |
| `green-db8792a.txt` | `8e7709072fd978788c3427758c0ceebacb8b87000e27c71859dcdaf3f4717774` |

## Scope and limits

This record proves the three exercise failures with the targeted server suites and shows those same suites passing on the fix candidate. It does not claim that a full test suite was run in these two worktrees. No Cloud Run deployment, traffic change, migration job, or shared test-data operation was performed.
