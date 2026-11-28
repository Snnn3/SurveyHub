# Lab 7 Issue #85 — Published Survey Metadata Contract Review

**Status:** Proposed contract; first review feedback addressed; reviewer re-review pending before Issue #86
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
updated Lab 7 announcement. Teammate Snnn3 provided substantive review on 28 November 2026. The
first-round findings are recorded in §7 and addressed in this revision; Issue #86 remains gated on
the reviewer's re-review and acceptance.

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
| Owner edits published title/description through UI and API; persisted after reload and visible on respondent form | STS-LAB7-01 (API) and STS-LAB7-06 (Playwright UI); owner save/reload and respondent-form flow | Contract only |
| Trimmed nonblank title <=120; optional description <=2,000 and clearable; exact limits and invalid values checked | STS-LAB7-02; boundary, trimming, clearing and partial-PATCH cases | Contract only |
| Metadata-only schema rejects structural/lifecycle fields atomically; IDs, order, answers, counts and timestamps preserved | STS-LAB7-01 (successful-write snapshot) and STS-LAB7-03 (rejected-write snapshot) | Contract only |
| Other owners/respondents denied; CLOSED locked; draft and published structure rules retained; close race guarded | STS-LAB7-04 and STS-LAB7-05; lifecycle regression and concurrency check | Contract only |

The planned verification is described in [F-02](../../sprints/sprint-1/f-02.md). No implementation,
test run or passing result is claimed by this review record.

## 6. Cross-document amendment plan

| Document | Accepted baseline | Proposed amendment in this branch |
|---|---|---|
| SRS | v5 | v6 updates FR-04, BR-04, BR-07 and Q3 |
| F-02 | v4 | v5 adds the state matrix, UI/API contract and LAB7-AC-01..04 / STS-LAB7-01..06 |
| System SDS | v5 | v6 adds the endpoint, validation, authorization and transaction boundary |
| Traceability | v5 | v6 maps the Lab 7 criteria to FR-04, BR-04, BR-07, NFR-SEC-02 and planned tests |

Each document labels the amendment proposed and awaiting reviewer re-review. These edits do not
claim that the new requirement is implemented or verified.

## 7. Teammate review record

| Field | Record |
|---|---|
| Reviewer | Snnn3 |
| Review submitted | 28 November 2026, 15:37:12 Asia/Bangkok (08:37:12 UTC) |
| Review | [PR #89 review 6096788187](https://github.com/Snnn3/SurveyHub/pull/89#pullrequestreview-6096788187) |
| Result | CHANGES_REQUESTED; Standards: no findings; Spec: request changes |
| Before revision | Commit a164c9b66a6c7d62348e885e3b0457d76c7b2602, 28 November 2026, 14:53:08 Asia/Bangkok |
| Response revision | 28 November 2026; documentation and test-plan updates recorded on the current PR branch |
| Disposition | All six findings accepted and addressed below. Request reviewer re-review; do not start Issue #86 until the contract is accepted. |

### Review text and before/after excerpts

1. **[P2] Map the criteria to affected code.** ([inline comment](https://github.com/Snnn3/SurveyHub/pull/89#discussion_r4726227913)) Reviewer: “Issue #85 Part A asks for FR-04/BR-04/BR-07 to map to acceptance criteria, affected code, test setup, and expected outcomes.” The review asked for an AC-to-code-to-test mapping for the planned API route/service, owner UI, and test files.
   - Before excerpt: `Lab 7 criterion | Requirement / rule | Contract location | Planned verification | Status`
   - After excerpt: `LAB7-AC-01 | ... | server/src/routes/survey.routes.ts ... client/src/pages/SurveyMetadataPage.tsx ... | ... | STS-LAB7-01, STS-LAB7-06`
   - After: [traceability §2.5](../../traceability.md) names the API route/controller/service/validator, owner and respondent UI paths, test setup and expected results for every LAB7 criterion.
   - Disposition: addressed; paths are explicitly marked planned for Issue #86.

2. **[P2] Specify the AC-01 UI verification.** ([inline comment](https://github.com/Snnn3/SurveyHub/pull/89#discussion_r4726227917)) Reviewer: “Issue #85 requires updates through both UI and API,” and asked for the owner's Edit details action plus save/reload/respondent assertions, listed separately from API verification.
   - Before excerpt: `Owner A patches title and description; reload owner detail and respondent form`
   - After excerpt: `STS-LAB7-01 (API) ... STS-LAB7-06 (UI)`; the UI test clicks Edit details, saves, reloads/reopens, and checks the respondent form.
   - After: STS-LAB7-01 covers API persistence; STS-LAB7-06 covers the Playwright owner Edit details, save, reload/reopen and respondent form flow.
   - Disposition: addressed.

3. **[P2] Assert preservation after a successful update.** ([inline comment](https://github.com/Snnn3/SurveyHub/pull/89#discussion_r4726227925)) Reviewer asked to compare question/option IDs and order, answers, response count and lifecycle timestamps after a successful write.
   - Before excerpt: `200; both reads show the new values; saved response remains readable`
   - After excerpt: `capture question/option IDs and order, answer rows, response count, publishedAt, closesAt and closedAt ... full captured data/lifecycle snapshot is unchanged`
   - After: STS-LAB7-01 captures the full fixture snapshot before the successful PATCH and asserts it is unchanged after owner detail and respondent-form reads; STS-LAB7-03 retains rejected-request atomicity checks.
   - Disposition: addressed.

4. **[P2] Test omitted-field behavior.** ([inline comment](https://github.com/Snnn3/SurveyHub/pull/89#discussion_r4726227920)) Reviewer: “Add title-only and description-only PATCH cases and assert the other value is preserved.”
   - Before excerpt: `Owner A patches title and description`
   - After excerpt: `Also send title-only and description-only PATCH bodies ... a one-field PATCH preserves the omitted field`
   - After: STS-LAB7-02 sends each single-field body separately and verifies the omitted field remains unchanged.
   - Disposition: addressed.

5. **[P2] Verify title trimming.** ([inline comment](https://github.com/Snnn3/SurveyHub/pull/89#discussion_r4726227923)) Reviewer asked to submit “  Course feedback  ” and assert “Course feedback” was persisted.
   - Before excerpt: `Submit title lengths 120/121, blank/whitespace title`
   - After excerpt: `title "  Course feedback  "`; expected `saved title is "Course feedback"`.
   - After: STS-LAB7-02 checks the padded nonblank title and asserts the returned/saved title is trimmed.
   - Disposition: addressed.

6. **[P2] Record this review and its disposition.** ([inline comment](https://github.com/Snnn3/SurveyHub/pull/89#discussion_r4726227928)) Reviewer asked for reviewer/date, requested changes and disposition, then a final disposition before Issue #86.
   - Before excerpt: `Review is pending. Before Issue #86 implementation, a teammate should check:`
   - After excerpt: `Reviewer: Snnn3 | Review submitted: 28 November 2026 | Result: CHANGES_REQUESTED | Disposition: All six findings accepted and addressed; request reviewer re-review.`
   - After: this section records reviewer Snnn3, review time, review link/result, before/after commit dates, all six findings and their dispositions.
   - Disposition: first-round findings addressed; final contract acceptance remains pending reviewer re-review. Issue #86 remains gated.

The first-round feedback is recorded here and linked to its original review and inline threads. No
application code or test results are included in this PR.

### Original reviewer text

The full review is preserved at the [PR review link above](https://github.com/Snnn3/SurveyHub/pull/89#pullrequestreview-6096788187). Its disposition was “Standards: No standards findings.” The following reviewer text records the complete six requests:

1. **[P2] Map the criteria to affected code.** “Issue #85 Part A asks for FR-04/BR-04/BR-07 to map to acceptance criteria, affected code, test setup, and expected outcomes. This table stops at contract locations and planned STS; the existing files listed in the review document are only baseline context. Add the planned API route/service, owner UI, and test files per criterion (or a separate AC-to-code-to-test table). Otherwise Part A's traceability deliverable remains incomplete and #86 has less precise implementation scope.”
2. **[P2] Specify the AC-01 UI verification.** “Issue #85 requires updates through both UI and API, but this test action only patches through the API and performs reads. Add the owner's Edit details UI action plus save/reload/respondent assertions, and list the API check separately. Otherwise an API-only implementation could pass the planned check while the required UI flow remains unverified.”
3. **[P2] Assert preservation after a successful update.** “The contract promises metadata writes leave questions/options, answers, counts, and lifecycle timestamps unchanged. STS-LAB7-03 checks the snapshot only after a rejected mixed-field request; STS-LAB7-01 only checks response readability. Compare the recorded snapshot before and after a successful metadata update.”
4. **[P2] Test omitted-field behavior.** “The endpoint contract says an omitted title or description stays unchanged. STS-LAB7-01 always patches both fields, so neither one-field request is covered. Add title-only and description-only requests and assert the other value is preserved.”
5. **[P2] Verify title trimming.** “The contract requires the saved title to be trimmed. STS-LAB7-02 checks blankness and length boundaries but does not assert that a nonblank title with surrounding spaces is persisted trimmed. Add an input such as "  Course feedback  " and assert the saved value is "Course feedback".”
6. **[P2] Record this review and its disposition.** “Issue #85 asks for a recorded substantive teammate review, and §7 says to record the reviewer, date, requested changes, and disposition. The file still says review is pending. Update §7 with this review and, after the requested changes are addressed, record the final disposition before #86 starts.”

The review verdict was “Request changes.” The complete dated review remains linked above, including
its test-scope note.
