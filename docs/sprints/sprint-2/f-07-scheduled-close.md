# F-07 Scheduled Close Contract

**System:** SurveyHub — Review, Feedback, and Survey System<br>
**Feature:** F-07 — Eligibility and scheduled close<br>
**Issue:** [#61 — Implement eligibility and scheduled-close policies](https://github.com/Snnn3/SurveyHub/issues/61)<br>
**Status:** Approved in PR #79 by YummieGG on 27 Nov 2026; implementation in progress<br>
**Baseline:** `sprint-2-staging` at `a94e089440cfb89c964e708e45e842fda26a5d14`<br>
**Related documents:** [SRS](../../srs.md), [feature inventory](../../features.md), [traceability](../../traceability.md), [system design](../../system-sds.md), [F-02](../sprint-1/f-02.md), [F-03](../sprint-1/f-03.md), [F-05](f-05.md)

## 1. Scope and ownership

F-07 lets an owner set, view, clear, or reschedule a survey's `closesAt`. No background scheduler is added: acceptance is derived from the survey's persisted status/deadline whenever a relevant read or write happens. The policy helper is pure so #72 can apply it atomically with response persistence. This issue owns schedule management and read-side acceptance status; #72 owns the final submission-time check inside its transaction.

Reuse `Survey.closesAt`, `Survey.closedAt`, and the existing `[status, closesAt]` index. No schema migration is needed. A scheduled deadline does not mutate `Survey.status` or `closedAt`; only the existing manual close operation sets `status = CLOSED` and `closedAt`.

## 2. Time and lifecycle rules

- Persist absolute instants as UTC timestamps. The owner UI uses a local date/time input, labels the browser's IANA timezone, converts to an ISO timestamp with offset on save, and converts the returned ISO timestamp back to local input on load. Round-trip preserves the same instant without a timezone shift.
- A schedule may be created, cleared, or changed while status is `DRAFT` or `PUBLISHED`. `CLOSED` is terminal and returns `400 SURVEY_NOT_EDITABLE`. A published survey whose deadline has passed remains `PUBLISHED` but does not accept responses; its owner may move the deadline into the future or clear it to resume acceptance. This is an explicit reopen action for a still-published survey. A survey closed manually cannot be reopened by changing or clearing its deadline.
- A non-null new deadline must be strictly later than the server's current time. `null` clears the schedule. Invalid, timezone-free, or past values return `400 VALIDATION_ERROR` and leave the saved deadline unchanged.
- A survey accepts responses only if status is `PUBLISHED` and either `closesAt` is null or `now < closesAt`. At exactly `closesAt` and after it, acceptance is false. A manual `CLOSED` status is always false regardless of deadline.
- `GET /api/surveys/active` reports `closesAt` and `acceptingResponses` for published surveys visible to that respondent. Expired surveys remain visible with `acceptingResponses: false`; the UI disables Start. `GET /api/surveys/:id/form` checks survey availability before F-07 eligibility: an expired or non-published survey returns `400 SURVEY_NOT_ACCEPTING_RESPONSES`; only an accepting published survey is then checked against the allowlist and may return `403 NOT_ELIGIBLE`. If both rules deny access, the availability error takes precedence. Neither error returns form data. #72 repeats both checks at submission time.

## 3. API and UI contract

### Owner schedule routes

Both routes require an authenticated `SURVEY_OWNER`, verify the survey owner before returning or changing data, and return only that survey's schedule.

`GET /api/surveys/:id/schedule` returns `200` with:

```json
{
  "success": true,
  "data": {
    "surveyId": "<uuid>",
    "status": "PUBLISHED",
    "closesAt": "2026-11-30T09:00:00.000Z",
    "acceptingResponses": true
  }
}
```

`closesAt` is `null` when no deadline is set. `acceptingResponses` is computed using server time and the §2 rule.

`PATCH /api/surveys/:id/schedule` takes the strict body `{ "closesAt": "2026-11-30T16:00:00+07:00" }` or `{ "closesAt": null }`. It returns `200` using the same response shape. Offset-bearing ISO values are normalized to UTC. A non-owner receives `403 FORBIDDEN_OWNERSHIP`, wrong role `403 FORBIDDEN_ROLE`, unknown ID `404 NOT_FOUND`, and a closed survey `400 SURVEY_NOT_EDITABLE`.

Owner survey list/detail responses also include `closesAt` and computed `acceptingResponses`. The respondent active-list item includes these fields in addition to its existing submission state. No client clock is authoritative.

### Owner settings UI

The dedicated owner policy settings page shows the current deadline, the detected timezone, and accessible loading/success/validation/error/denial states. It supports setting, changing, and clearing the deadline. On `403`, it shows generic “Access denied” without displaying schedule or survey data. The respondent active list disables “Start survey” and displays “This survey is no longer accepting responses” when `acceptingResponses` is false; an expired survey remains `PUBLISHED` and can be reopened by changing or clearing its deadline.

## 4. Deadline policy helper

`isSurveyAcceptingResponses({ status, closesAt, now })` is pure. It returns `true` only for `PUBLISHED` and `closesAt === null || now < closesAt`. It accepts the reference time explicitly; it does not call `Date.now()`, write `closedAt`, or access a database. #72 invokes the helper using the transaction's survey row and its single captured server time.

## 5. Acceptance criteria

| ID | Observable outcome |
|---|---|
| **AC-S2-04-01** | An owner can set, view, change, and clear `closesAt` for a draft or published survey they own; a non-owner, wrong role, or unknown ID is denied without schedule/survey data. |
| **AC-S2-04-02** | Offset-bearing ISO input persists as the same UTC instant and reads back without a time shift; UI shows the timezone used for local entry. |
| **AC-S2-04-03** | Null deadline means no scheduled close; a non-null deadline must be valid and future. Invalid/past input returns `400 VALIDATION_ERROR` and leaves persisted state unchanged. |
| **AC-S2-04-04** | The helper deterministically returns acceptance for no deadline, before, exactly at, and after the deadline; DRAFT and manual `CLOSED` remain non-accepting. |
| **AC-S2-04-05** | Relevant owner/respondent read paths return the current `closesAt`/`acceptingResponses`; the form route returns `400 SURVEY_NOT_ACCEPTING_RESPONSES` for a non-published or expired survey before checking eligibility, without returning questions. No scheduler is required. |
| **AC-S2-04-06** | The schedule UI supports load/save/clear with accessible pending, success, validation, server-error, and denial states; respondent UI disables submission entry when the read says not accepting. |
| **AC-S2-04-07** | #72 returns `400 SURVEY_NOT_ACCEPTING_RESPONSES` at/after the exact boundary through the real submission transaction and proves response, claim, and answer state is unchanged. #61 does not claim this integration result. |

## 6. Verification specification

These are planned checks, not claimed results. Database/API tests use the dedicated test database.

| Test ID | Level | Setup and action | Expected result |
|---|---|---|---|
| **STS-S2-04-01** | API + DB | Owner A reads and changes the deadline on draft/published surveys; owner B, respondent, and unknown ID call schedule routes. | Owner receives exact schedule; role/ownership/not-found errors match §3 and expose no private data. |
| **STS-S2-04-02** | API + DB | Save an offset timestamp, reload it, and compare epoch milliseconds; try invalid, timezone-free, and past timestamps; compare DB before/after rejection. | Valid input round-trips to the same instant in UTC; invalid/past input returns 400 and leaves DB unchanged. |
| **STS-S2-04-03** | Unit | Call helper with null, future, equal-to-now, past deadline, DRAFT, and manually CLOSED status. | True only for a published survey before its deadline or with no deadline. |
| **STS-S2-04-04** | API + DB | Read owner detail/list and respondent active list before and after close time; request a form at/after deadline as both eligible and ineligible respondents; then extend or clear the deadline on the still-published survey and try again. | Payload reports current acceptance; both expired requests return `400 SURVEY_NOT_ACCEPTING_RESPONSES` before eligibility is checked; an ineligible respondent gets `403 NOT_ELIGIBLE` only for an accepting published survey; rescheduling/clearing reopens the still-published survey; manual `CLOSED` stays closed. |
| **STS-S2-04-05** | UI | Save/reload/clear a deadline, inspect timezone label and denial/error/pending states, then view an expired survey as respondent. | The same instant is displayed after reload; messages are accessible; expired survey cannot be started. |
| **STS-S2-04-06** | Integration + DB (#72) | Submit through the real route immediately before, exactly at, and after the stored deadline; compare response, claim, and answer rows. | Before is accepted by the policy; at/after returns `400 SURVEY_NOT_ACCEPTING_RESPONSES` and writes no rows. Executed and reported by #72 only. |

## 7. Definition of done and revision history

- Contract and date/lifecycle decisions are reviewed and agreed before F-07 behavior changes.
- No migration or background worker is added; current `closesAt`/`closedAt` fields and the existing index suffice.
- #61 owns deadline management, read-side status, owner/respondent UI, deterministic helper, and focused checks. #72 owns atomic submit-time enforcement and zero-write integration evidence.
- The feature PR targets `sprint-2-staging`, links #61, reports actual checks, and waits for teammate approval and required checks before merge.
- Issue #61 remains open until #72 records the exact-boundary integration result in AC-S2-04-07 and the rest of this contract is verified.

| Version | Date | Change | Status |
|---|---|---|---|
| v1 | 27 Nov 2026 | Define UTC deadline/lifecycle rules, schedule API, read-side acceptance status, deterministic helper, AC and verification cases for Issue #61. | Draft for teammate review; no implementation or test results claimed |
| v2 | 27 Nov 2026 | Clarify that an owner can reopen a still-published survey by extending or clearing an expired deadline; manual close remains terminal. | Draft for teammate review; no implementation or test results claimed |
| v3 | 27 Nov 2026 | Specify that form availability takes precedence over eligibility and test both eligible and ineligible respondents against expired surveys. | Draft for teammate review; no implementation or test results claimed |
| v4 | 27 Nov 2026 | Clarify the scheduled-close UI message and add published/acceptance/deadline/error conditions to the SDS submission matrix. | Draft for teammate review; no implementation or test results claimed |
| v5 | 27 Nov 2026 | Record teammate approval of the F-07 scheduled-close contract in PR #79 before behavior implementation. | Approved; implementation in progress |
