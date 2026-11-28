# Lab 7 Issue #86 — Implementation and Verification Record

**Issue:** [#86 — Implement and test published survey metadata edits](https://github.com/Snnn3/SurveyHub/issues/86)
**Contract:** [Issue #85 reviewed contract](issue-85-contract-review.md)
**Target branch:** `lab-7-staging`
**Feature branch:** `feature/86-published-survey-metadata`
**Status:** In progress; verification results are recorded only after commands run.

## Baseline and contract follow-up

- Pre-change source commit: `f1e6e7ce15d36ce944e5edae9e2ffe161750e68c` (PR #89 merged into `lab-7-staging`).
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
| RED on pre-change behavior | `f1e6e7ce15d36ce944e5edae9e2ffe161750e68c` | Pending execution | Pending |
| GREEN after implementation | Pending | Pending | Pending |
| Adjacent regression | Pending | Pending | Pending |
| UI E2E | Pending | Pending | Pending |
| Client/server build and type checks | Pending | Pending | Pending |

Raw test output, actual pass/fail/skip counts, and implementation/test SHAs will be added after
execution. No result is claimed by this plan.
