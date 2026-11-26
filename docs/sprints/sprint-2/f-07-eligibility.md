# F-07 Respondent Eligibility Contract

**System:** SurveyHub — Review, Feedback, and Survey System<br>
**Feature:** F-07 — Eligibility and scheduled close<br>
**Issue:** [#61 — Implement eligibility and scheduled-close policies](https://github.com/Snnn3/SurveyHub/issues/61)<br>
**Status:** Draft for teammate review; behavior changes are gated on agreement<br>
**Baseline:** `sprint-2-staging` at `a94e089440cfb89c964e708e45e842fda26a5d14`<br>
**Related documents:** [SRS](../../srs.md), [feature inventory](../../features.md), [traceability](../../traceability.md), [system design](../../system-sds.md), [F-05](f-05.md), [F-06](f-06.md)

## 1. Scope and ownership

F-07 lets an owner manage the respondents allowed to submit to a survey and provides a pure eligibility decision helper for #72. An empty allowlist means every authenticated `RESPONDENT` is eligible. A non-empty list means only listed respondents are eligible. This issue owns the allowlist API, its owner settings UI, the helper, and focused tests. #72 alone applies the decision inside the response transaction and proves rejection has no partial writes.

Reuse `SurveyEligibility(surveyId, userId)`, its unique constraint and user index. No schema migration or account-directory endpoint is needed. The API accepts respondent emails so owners do not need internal user IDs; it returns identity details only for accounts already on that survey's allowlist. It never lists unrelated accounts.

## 2. Lifecycle, validation, and privacy

- An owner may replace the allowlist for a survey they own while it is `DRAFT` or `PUBLISHED`. A manually `CLOSED` survey is terminal and returns `400 SURVEY_NOT_EDITABLE` for changes.
- Only existing accounts with role `RESPONDENT` may be added. Email input is trimmed and matched case-insensitively. Duplicate normalized addresses, malformed addresses, unknown accounts, and accounts with another role are rejected without changing the saved list. Unknown and wrong-role addresses use one generic `400 INVALID_ELIGIBILITY` response; the response does not reveal account names, roles, or existence.
- A non-owner receives `403 FORBIDDEN_OWNERSHIP`; a caller without `SURVEY_OWNER` receives `403 FORBIDDEN_ROLE`; an unknown survey returns `404 NOT_FOUND`.
- `GET` returns only the selected eligible accounts (`userId`, `email`, `fullName`). No endpoint provides a searchable or complete respondent directory.
- The helper denies the survey owner, any role other than `RESPONDENT`, and any respondent outside a populated allowlist. It permits any other respondent when the allowlist is empty.
- The respondent `GET /api/surveys/active` list includes only published surveys whose allowlist is empty or contains that respondent. It does not reveal whether any other survey or account exists. `GET /api/surveys/:id/form` returns `403 NOT_ELIGIBLE` before returning question data when the requester is outside a populated allowlist. #72 rechecks eligibility inside the submission transaction.

## 3. API contract

Both routes require an authenticated `SURVEY_OWNER` and verify ownership before returning or changing survey data.

### `GET /api/surveys/:id/eligibility`

Returns `200`:

```json
{
  "success": true,
  "data": {
    "surveyId": "<uuid>",
    "eligibleRespondents": [
      { "userId": "<uuid>", "email": "resp1@survey.local", "fullName": "Student Respondent One" }
    ]
  }
}
```

An empty `eligibleRespondents` array means all respondents are eligible.

### `PUT /api/surveys/:id/eligibility`

Replaces the complete allowlist; omitted accounts are removed. The body is strict:

```json
{ "respondentEmails": ["resp1@survey.local", "resp2@survey.local"] }
```

An empty array clears the allowlist. A successful `200` returns the same shape as `GET`. The replacement is atomic: every address is validated and resolved before any row is changed.

### Eligibility decision helper

`evaluateRespondentEligibility({ respondentId, respondentRole, surveyOwnerId, eligibleRespondentIds })` is pure and returns `{ allowed, reason }`. Reasons are `ALLOWED`, `SURVEY_OWNER`, `INVALID_ROLE`, and `NOT_ELIGIBLE`. It accepts no database client and does not create responses, claims, or answers. #72 may call it inside its transaction using the row-locked survey, current respondent role, and eligibility IDs.

## 4. Acceptance criteria

| ID | Observable outcome |
|---|---|
| **AC-S2-03-01** | An owner can read and replace the eligibility list only for their own survey; wrong-role, non-owner, and unknown-survey responses follow §2 and disclose no survey or account data. |
| **AC-S2-03-02** | The owner can add and remove existing `RESPONDENT` accounts by email. Invalid, duplicate, unknown, and wrong-role entries reject the whole update and leave the prior list unchanged. |
| **AC-S2-03-03** | An empty list permits any authenticated respondent; a populated list permits only listed respondents. The active list filters out non-eligible surveys, form access returns `403 NOT_ELIGIBLE` without question data, and no unselected account is returned by the management API. |
| **AC-S2-03-04** | The pure helper deterministically reports allow/deny for an empty list, a listed/unlisted respondent, an invalid role, and survey-owner context without writing response data. |
| **AC-S2-03-05** | Allowlist changes work in `DRAFT` and `PUBLISHED`; a manually `CLOSED` survey rejects changes with `400 SURVEY_NOT_EDITABLE` and preserves its list. |
| **AC-S2-03-06** | The owner settings UI has accessible loading, success, validation-error, API-error, and access-denied states; denial does not reveal account or survey data. |
| **AC-S2-03-07** | #72 verifies `403 NOT_ELIGIBLE` through the real submission route and proves response, claim, and answer state is unchanged when eligibility rejects. #61 does not claim this integration result. |

## 5. Verification specification

These are planned checks, not claimed results. Database tests use the dedicated test database and existing reset helpers.

| Test ID | Level | Setup and action | Expected result |
|---|---|---|---|
| **STS-S2-03-01** | API + DB | Owner A reads and replaces its own draft/published survey list; Owner B and a respondent try the same routes; try an unknown survey. | Owner receives only selected account details; wrong role is `403 FORBIDDEN_ROLE`, other owner is `403 FORBIDDEN_OWNERSHIP`, unknown ID is `404 NOT_FOUND`; no private data appears. |
| **STS-S2-03-02** | API + DB | Replace a list with valid respondent emails, then try malformed, duplicate, unknown, owner-role, and mixed valid/invalid addresses; compare stored rows before/after each rejected call. | Valid replacement persists; every invalid request returns the documented 400 and leaves the entire list unchanged. |
| **STS-S2-03-03** | Unit | Call the helper with an empty list, a matching/nonmatching respondent, an invalid role, and the survey owner. | Returns the documented `allowed` and `reason`; no write interface is available. |
| **STS-S2-03-04** | API + DB | Clear a populated list, then restore a populated list; call the active-list and form routes as listed and unlisted respondents. | Empty list is unrestricted; a populated list shows the survey/form only to listed respondents; unlisted form access is `403 NOT_ELIGIBLE` with no question data. |
| **STS-S2-03-05** | API + DB | Change a list for a draft, published, and manually closed survey. | Draft/published changes persist; closed change returns `SURVEY_NOT_EDITABLE` and preserves rows. |
| **STS-S2-03-06** | UI | Open the owner policy settings, load/save a list, trigger validation/server errors, and open another owner's survey. | Loading/success/errors are accessible; denied state shows no private data; email entries can be added/removed and cleared. |
| **STS-S2-03-07** | Integration + DB (#72) | Submit through the real route as an unlisted respondent and compare response, claim, and answer rows before/after. | Returns `403 NOT_ELIGIBLE`; no rows are added. Executed and reported by #72 only. |

## 6. Definition of done and revision history

- Contract and interface are reviewed and agreed before F-07 behavior changes.
- No migration is needed; the existing `SurveyEligibility` unique constraint prevents duplicate membership.
- #61 owns the policy helper, owner-only management API/UI, and its focused checks. #72 owns atomic submission enforcement and zero-write integration evidence.
- The feature PR targets `sprint-2-staging`, links #61, reports actual checks, and waits for teammate approval and required checks before merge.
- Issue #61 remains open until #72 records the integration result in AC-S2-03-07 and the rest of this contract is verified.

| Version | Date | Change | Status |
|---|---|---|---|
| v1 | 27 Nov 2026 | Define allowlist API, account-exposure boundary, lifecycle, pure decision helper, AC and verification cases for Issue #61. | Draft for teammate review; no implementation or test results claimed |
