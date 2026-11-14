# Issue #31: E2E authentication transition verification

**Status snapshot (14 Nov 2026, before PR #33 merged):** [PR #32](https://github.com/Snnn3/SurveyHub/pull/32) had merged into `sprint-1-staging` at `f1b3c097d1107b7ea16469f31fe8a8a8a2d63f93`, and Issue [#31](https://github.com/Snnn3/SurveyHub/issues/31) had been closed after verification. [PR #33](https://github.com/Snnn3/SurveyHub/pull/33) was open to promote the change to `main`. This document records local verification, not a GitHub Actions or release result.

## Reproduction before the change

The affected test file on the `origin/sprint-1-staging` base (`b5dfe2d41c2939ec5e7401f0fae298b14461d6e2`) had the same tracked tree as `main` at `c71446b3a5dc78ae3bb90ed55fe0f901114f1c70`.

Command: `npm run test:e2e`

- The database safety guard passed and the client/server production build completed.
- Playwright failed 0/2 journeys; both reached the 30-second timeout.
- STS-E2E-01 timed out looking for the Email field after owner logout. Its browser snapshot still showed the authenticated owner dashboard.
- STS-E2E-02 timed out looking for the seeded survey's “Start survey” link. Its browser snapshot showed the sign-in page after the test navigated to `/surveys`.

The existing `signIn` helper returned as soon as it clicked Sign in, before the asynchronous login request, `/auth/me` request, and role navigation completed. Logout was also followed immediately by the next sign-in. The app's handlers in `client/src/App.tsx` perform those requests and navigation asynchronously.

## Change

Commit `ebfc6c533cba498ae807e1b5ce8f080433809e6b` (`test(e2e): synchronize auth transitions (#31)`) updates only `e2e/sprint1-survey-flow.spec.ts`:

- Sign-in waits for HTTP 200 from `/api/auth/login`, the expected role landing URL, and the Log out button.
- Sign-out waits for HTTP 200 from `/api/auth/logout`, the `/login` URL, and the Email field.
- Both respondent journeys assert the expected survey row and Start survey link are visible before clicking.
- Existing submission, summary, duplicate, privacy, and revoked-token assertions remain in place.

## Verification

Environment: macOS local checkout; Node.js `v26.5.0`; npm `11.17.0`; PostgreSQL `16.15`; isolated database `surveyhub_test`. The Playwright production server ran with `NODE_ENV=production`; the database guard reported that its unsafe reset command was never called.

On the same source commit `ebfc6c533cba498ae807e1b5ce8f080433809e6b`:

| Command | Result |
| --- | --- |
| `npm run test:e2e` — repeat 1 | Guard and production build passed; 2/2 E2E journeys passed (6.6 s). |
| `npm run test:e2e` — repeat 2 | Guard and production build passed; 2/2 E2E journeys passed (5.9 s). |
| `npm test` | 7 suites / 60 tests passed. |
| `npm run typecheck` | Server and client typechecks passed. |
| `git diff --check` | Passed. |

## Limit

This confirms the targeted fix across two consecutive local E2E runs and the server regression suite. It does not establish a GitHub Actions result or a merged release result. At the status snapshot above, Issue #31 was closed after PR #32 merged into staging, and PR #33 was pending promotion to `main`.
