# Lab 7 Issue #85 — Published Survey Metadata Contract Review

**Status:** Proposed contract; teammate review pending
**Issue:** [#85 — Define the published survey metadata rule and review the contract](https://github.com/Snnn3/SurveyHub/issues/85)
**Implementation:** Issue [#86](https://github.com/Snnn3/SurveyHub/issues/86), after contract review
**Release and report:** Issue [#87](https://github.com/Snnn3/SurveyHub/issues/87)
**Prepared:** 28 November 2026

## 1. Change being reviewed

The accepted Sprint 1 rule blocks every edit after publication. The Lab 7 proposal lets a survey
owner correct the published survey title and respondent-facing description. It does not unlock
questions or options and does not change responses or lifecycle state. A CLOSED survey stays
locked.

The maintenance brief says instructor/TA approval is no longer required for this change under the
updated Lab 7 announcement. This document records the proposed contract for substantive teammate
review before implementation starts. No teammate review is recorded yet.

## 2. Baseline, source and deployed state

These are separate reference points; the release tag, current source commit and deployed revision
must not be treated as interchangeable.

| Reference | Verified value | What it represents |
|---|---|---|
| Sprint 1 release baseline | Tag v0.1.0-sprint1 at commit 6bbbdd8380d5428d8dd5437a7374858fd4737870 | Released Sprint 1 snapshot and accepted document/code baseline |
| Lab 6 staging integration | Commit a4fbb6411e967897bb4d065ec495195412762dc4; promoted by PR #77 | Integrated Lab 6/UAT work before the current main snapshot |
| Pre-change source and Lab 7 staging base | origin/main at commit da9c2f2fd9cd6e92ee530b524a4db2dae979b2ee (28 November 2026) | Latest remote main used to initialize lab-7-staging and this issue branch |
| Pre-change deployed service | Cloud Run revision s7c512824-00016-nvg, 100% traffic, source commit da9c2f2fd9cd6e92ee530b524a4db2dae979b2ee | Actual service revision observed on 28 November 2026; image digest sha256:f0b1b3b9cd6dbfda0a8a03ab574850b6c13b1d9fda5a7b26e0a9d1dd78560859 |

Intervening work after the Sprint 1 release includes the Lab 5 cloud and CI sequence (PRs #39,
#46, #48, #50, #53 and #55), followed by Lab 6 UAT and promotion through PR #77. These changes
advance deployment and integration state; the published-metadata correction is still a proposed
Lab 7 change. The current main/deployed source has no metadata-only survey endpoint.

## 3. Existing contract and implementation

| Area | Baseline behavior |
|---|---|
| SRS v5 | FR-04 covers draft question authoring. BR-07 blocks metadata and structure edits after publish. |
| F-02 contract v4 | DRAFT supports full edit/delete. PUBLISHED supports close and summary only. CLOSED has no update/delete. |
| SDS v5 | PUT /api/surveys/:id replaces survey metadata and the question set, only in DRAFT. No metadata-only endpoint is specified. |
| API implementation | server/src/routes/survey.routes.ts registers PUT /:id but no metadata PATCH route. server/src/services/survey.service.ts locks the survey row for full updates and close, then checks owner and status. |
| Regression coverage | STS-F02-10 in server/tests/survey-lifecycle.test.ts expects PUT and DELETE on PUBLISHED/CLOSED surveys to return 400 SURVEY_NOT_EDITABLE. Existing structural protection remains required. |

The existing row-level lock used by update, publish and close provides the concurrency mechanism
for the proposed metadata operation. Issue #86 should use that same survey-row serialization
boundary, then recheck ownership and PUBLISHED status before writing.

## 4. Proposed contract

### Endpoint and UI

- Add PATCH /api/surveys/:id/metadata for an authenticated SURVEY_OWNER who owns the survey.
- Permit the operation only while status is PUBLISHED at write time.
- Add an owner-facing Edit details action for PUBLISHED surveys. It edits title and description
  only. The respondent form must show the saved values on a new load.
- Keep the existing PUT draft editor, draft deletion, published structural locks, and CLOSED
  terminal state unchanged.

### Request and validation

- Accept a strict JSON object with at least one of title or description. Reject all other fields,
  including questions, options, mode, status, owner and lifecycle timestamps. Reject the whole
  request if valid metadata is combined with a forbidden field.
- Trim title; require 1–120 characters after trimming.
- Trim an optional description; allow up to 2,000 characters. Empty string or null clears it;
  omission leaves it unchanged.
- Return 200 and updated survey detail on success. Invalid body/values return 400
  VALIDATION_ERROR. Wrong role or owner returns 403. Unknown id returns 404. DRAFT or CLOSED
  returns 400 SURVEY_NOT_EDITABLE.

### Preserved data and concurrency

- Write only surveys.title and surveys.description (updatedAt may advance).
- Do not change question/option IDs or order, answers, response rows/count, publishedAt, closesAt,
  closedAt or status.
- Serialize metadata edits with close using the survey row lock. If close commits first, reject the
  metadata write without saving either field. If metadata commits first, the close may then finish;
  final state is CLOSED.
- No database migration is expected because title and description already exist.

## 5. Acceptance criteria and planned evidence

| Issue #85 criterion | Planned evidence for Issue #86 | State |
|---|---|---|
| Owner edits published title/description through UI and API; persisted after reload and visible on respondent form | STS-LAB7-01; API and UI journey | Contract only |
| Trimmed nonblank title <=120; optional description <=2,000 and clearable; exact limits and invalid values checked | STS-LAB7-02; boundary matrix | Contract only |
| Metadata-only schema rejects structural/lifecycle fields atomically; IDs, order, answers, counts and timestamps preserved | STS-LAB7-03; before/after database snapshot | Contract only |
| Other owners/respondents denied; CLOSED locked; draft and published structure rules retained; close race guarded | STS-LAB7-04 and STS-LAB7-05; lifecycle regression and concurrency check | Contract only |

The planned verification is described in [F-02](../../sprints/sprint-1/f-02.md). No implementation,
test run or passing result is claimed by this review record.

## 6. Cross-document amendment plan

| Document | Accepted baseline | Proposed amendment in this branch |
|---|---|---|
| SRS | v5 | v6 updates FR-04, BR-04, BR-07 and Q3 |
| F-02 | v4 | v5 adds the state matrix, UI/API contract and LAB7-AC-01..04 / STS-LAB7-01..05 |
| System SDS | v5 | v6 adds the endpoint, validation, authorization and transaction boundary |
| Traceability | v5 | v6 maps the Lab 7 criteria to FR-04, BR-04, BR-07, NFR-SEC-02 and planned tests |

Each document labels the amendment proposed and pending review. These edits do not claim that the
new requirement is implemented or verified.

## 7. Teammate review record

Review is pending. Before Issue #86 implementation, a teammate should check:

- whether PATCH /api/surveys/:id/metadata and the response/error behavior fit the existing API;
- whether empty/null description clearing and title/description trimming are precise enough;
- whether the forbidden-field list and preservation assertions cover the full survey schema;
- whether the close-race outcome is implementable with the existing row lock and database;
- whether each issue criterion maps to a test that can fail before the implementation and pass
  after it.

Record the reviewer, date, requested changes and disposition here after the review. Do not mark the
contract accepted until that review is complete.
