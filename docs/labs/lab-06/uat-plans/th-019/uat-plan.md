<!-- Purpose: This is the SurveyHub Sprint 1 UAT plan and test-case set prepared by Product Team TH-019 for independent execution by TH-044. It specifies our product, release, scope, test data, steps, and expected results; the Approval Flow UAT cases supplied by TH-044 test their own product. Record actual outcomes in the separate execution log. -->

# SurveyHub Sprint 1 UAT Plan and Handoff

**Purpose:** This is the SurveyHub test plan that Product Team TH-019 hands to Independent UAT Team TH-044. Run the seven cases below against the SurveyHub release stated here. The separate Approval Flow UAT pack from TH-044 is for the reverse direction and is not the test target in this file.

- **Course:** CPE 334 Software Engineering, Semester 1/2026 — Lab 6
- **Product:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
- **Product Team:** TH-019
- **Independent UAT Team:** TH-044 หมา
**Plan status:** Ready for partner execution. Case results and the final acceptance decision are intentionally left for the UAT Team.

## 1. Teams

| Role | Team / person |
|---|---|
| Product Team | Worawut Sereethai (@YummieGG) |
| Product Team | Chanon Lhumsa-ard (@Snnn3) |
| Independent UAT Team | WIRACHAT THONGUTHAISRI |
| Independent UAT Team | POOMIPAT APIWATTANAPHONG |

Both TH-044 students must each execute at least one case and review the recorded results. Product Team members participate in handoff, defect triage, fix review, and release work. Only TH-044, as the independent UAT Team, records the final acceptance decision.

## 2. Release and environment

| Item | Value for handoff |
|---|---|
| Repository | https://github.com/Snnn3/SurveyHub |
| Sprint 1 baseline | Tag v0.1.0-sprint1; SHA 827ed220e6d2290193df7d5234ed3b757ec38988 |
| Release designated for UAT | Commit ac2ae8ff5780cb1e1f1da1c199a7aaf89e686519 on main, merged through PR #55 |
| Deployment evidence | Deploy SurveyHub workflow run #10, attempt 2: https://github.com/Snnn3/SurveyHub/actions/runs/45007364345 |
| Canonical Cloud Run URL last observed | https://s7c512824-670075229477.asia-southeast1.run.app |
| Cloud Run revision last observed before UAT | s7c512824-00012-65k, 100% traffic; deployed 2026-11-22 23:24:12 +07:00 |
| Health route | GET /api/health; verify HTTP 200 and database status up before execution |
| Browser and OS | Use a current desktop Chrome, Edge, Firefox, or Safari; record the actual browser/version and OS |

The URL, traffic-serving revision, health response, build/footer, and source SHA above are the last recorded handoff values. Before the first case, TH-044 must recheck the live URL, health route, and revision actually receiving traffic, then record the values observed in the execution log. Do not assume a previously observed revision is still current.

The deployment is frozen during UAT. TH-019 will tell TH-044 before any deployment that could affect the run. If a new release is needed, both teams must agree on the new build, source SHA, URL, and serving revision; record the exact release tested for each result.

The baseline and deployed release are separate references. UAT cases below target the designated deployed release; they do not ask TH-044 to compare it with the baseline. The Product Team reports that the server source and Prisma schema are unchanged between the baseline and UAT release, with the build footer being the client-side difference.

The versioned Sprint 1 contracts are in [docs/sprints/sprint-1](../../../../sprints/sprint-1/README.md). Expected results below follow those contracts.

## 3. Accepted scope

Test implemented SurveyHub Sprint 1 behavior:

| Feature | Included behavior |
|---|---|
| F-01 Authentication, session, and RBAC | Sign in, identity/role, invalid credentials/input, protected routes, logout, and token revocation |
| F-02 Survey lifecycle and authoring | Owner-only listing, draft create/read/update/delete, publish validation, publish/close transitions, and ownership protection |
| F-03 Survey taking and response rules | Published survey list/form, required answers, valid single-choice/short-text responses, duplicate prevention, closed-survey rejection, own receipt, and cross-user privacy |
| F-04 Aggregate summary | Zero-response state, counts and percentages using each question's answeredCount, short-text answers without respondent identity, and owner-only access |

**Out of scope:** F-05 anonymous responses; F-06 expanded question types; F-07 allowlists and scheduled close; F-08 charts, export, and raw response browsing; and other Sprint 2/3 features. The seeded Owner 2 Course Pulse contains a Sprint 2 RATING question and may be used only for the specified ownership-denial check. Do not report its unsupported question type as a Sprint 1 defect. Personal Finance balance/transaction scenarios do not apply to SurveyHub.

The seven manual cases cover specified user-visible behavior and selected same-origin API responses. They do not replace engineering-only checks such as simultaneous-request assertions, database inspection, password-hash verification, or the Product Team's RED/GREEN evidence. Do not claim those checks were verified by this UAT pack.

## 4. Safe test accounts

All accounts below are synthetic seeded users. Sign in with the email address; there is no separate username. All four accounts use the same shared test password, which TH-019 supplies to TH-044 separately through the agreed private course channel. The password is intentionally omitted from this file, Git, evidence, and reports.

| Label | Login email | Role | Use |
|---|---|---|---|
| Owner-1 | owner1@survey.local | SURVEY_OWNER | Create/manage UAT surveys and view summaries |
| Owner-2 | owner2@survey.local | SURVEY_OWNER | Check cross-owner access denial against Owner-1's UAT survey |
| Resp-1 | resp1@survey.local | RESPONDENT | Primary synthetic respondent and receipt owner |
| Resp-2 | resp2@survey.local | RESPONDENT | Second respondent and cross-receipt denial |

If an account cannot sign in, mark affected cases BLOCKED, tell TH-019, and do not substitute personal or production data. Never capture or report passwords, bearer tokens, Authorization headers, or secret environment values.

## 5. Test data and safety rules

- Use only synthetic survey titles and answers. Never enter real student, survey, or personal information.
- Replace <TEAM> with a short partner code containing letters/numbers only (use TH044) and <RUN> with a unique date/time suffix, such as 20261124-1430. Use titles such as UAT-<TEAM>-<RUN>-J01 and keep every title under 120 characters.
- Create new UAT surveys; do not modify or delete seeded surveys. The seeded Internal Team Survey Draft is not a test object.
- Owner 2 Course Pulse (00000000-0000-4000-a000-000000000003) is a read-only fixture for the UAT-04 access-denial check. Do not close, edit, delete, or submit a response to it.
- Responses are limited to one per user per survey and cannot be removed through the Sprint 1 UI. Record survey IDs, response IDs, receipt URLs, and which accounts submitted before continuing.
- The Reviewer's or Owner's lists may contain other testers' data. Identify each UAT object by its exact title and ID.
- For API cases, use the accompanying 08_API_Reference_for_UAT.md from the handoff folder and same-origin calls from the SurveyHub browser session. Never paste an API route directly into the address bar when the case requires an authenticated request.
- Optional API supplements add detail but do not replace required UI steps. If skipped, record NOT RUN (optional); this does not block the case. If run and unexpected, record and triage the actual result.
- Capture evidence with the case ID, action, actual result, time, tester, source SHA, and deployed revision. Hide passwords, tokens, request headers, and unrelated personal browser data.
- If an access-control operation unexpectedly succeeds, stop further mutations on that object, preserve sanitized evidence, and verify its state through its legitimate owner.

## 6. Run order and cleanup

1. Before testing, recheck the deployed URL, health response, serving revision, source SHA/build, browser, and OS. Record what was actually observed.
2. Run UAT-01 first. Record its survey ID and the Resp-1 and Resp-2 response IDs; UAT-04 and UAT-05 depend on this data.
3. Run UAT-02 and record its survey ID; UAT-04 uses this closed survey.
4. Run UAT-03 and record its survey and response details.
5. Run UAT-04, then UAT-05. Keep the UAT-01 survey open until UAT-05 is complete.
6. Run UAT-06. UAT-07 may run at any point, preferably before other login-heavy cases.
7. After evidence capture, sign in as Owner-1 and close every temporary UAT survey still PUBLISHED. Delete only temporary UAT surveys that remain DRAFT. Keep seeded fixtures unchanged. Record the cleanup time and any item that could not be cleaned up.
8. Do not reset/reseed Cloud SQL or run local destructive reset commands against the deployed service.

## 7. Execution, defects, and acceptance

Each case starts NOT RUN. For every case, record the actual tester name(s), date/time (+07:00), URL, browser/version and OS, source SHA/build, serving revision, inputs and generated IDs, actual result, PASS/FAIL/BLOCKED/NOT RUN status, and evidence ID. Do not copy the expected result into the actual-result field.

If an expected result differs, retain sanitized evidence and report: case and AC, tested release, preconditions/test data, exact reproduction steps, expected result, actual result, severity with user-impact reason, whether it is a contract defect or feature request, and evidence. Do not stop at “it failed”; record what the system actually did.

During triage, Product Team TH-019 and UAT Team TH-044 classify each finding as accepted defect, duplicate, not a defect, or enhancement; tie the decision to the Sprint 1 contract; assign severity and owner; record fix status/release; and plan independent retest. TH-044 retests the same case against the identified fix release and records the result.

Only TH-044 records the final acceptance decision: Accepted, Accepted with documented minor limitations, or Not accepted. Critical/Major accepted defects block acceptance until fixed and independently retested. A Minor defect must be fixed or explicitly accepted by TH-044 as a documented limitation. Do not invent a defect when none is observed. The accompanying execution log, defect/triage log, evidence register, and retest/acceptance form hold the actual records; this plan contains only the cases and expected outcomes.

## 8. Seven test cases

UAT-01 → UAT-02 → UAT-03 → UAT-04 → UAT-05 → UAT-06 is the recommended sequence. UAT-07 may run at any point. Run each case against the release verified in Section 2.

UAT plans and cases are prepared for TH-044 to execute against SurveyHub. The results in this file are expected behavior, not observed test outcomes.

## Detailed test cases

**Test level:** Manual user acceptance against the deployed release in this handoff plan; same-origin API calls are included only where the UI does not expose the contract result.
**Run order:** UAT-01 → UAT-02 → UAT-03 → UAT-04 → UAT-05 → UAT-06. UAT-07 can run at any point.
**Status rule:** Each case starts `NOT RUN`. Record actual observations separately in the accompanying execution log.

## Common execution rules

- Use only the four synthetic accounts in the handoff. The two students on the partner team must both execute at least one case and both must review the results.
- Replace `<TEAM>` and `<RUN>` with a short unique code before creating any survey. Keep the generated title and survey/response IDs in the log.
- In DevTools snippets, replace `${surveyId}`, `${responseId}`, `${uat01SurveyId}` and similar names with the UUIDs recorded for that run, or define variables with those names first.
- Follow each case's setup exactly. Do not use or change seeded surveys except the read-only access fixture stated in UAT-04.
- For API checks, use the helper in the accompanying API reference. Capture only the sanitized status/result. Keep passwords, tokens and request headers out of evidence.
- Actions marked **Optional API supplement** add API-only detail; they do not replace required UI actions. If omitted, record `NOT RUN (optional)` and do not mark the case `BLOCKED` for that reason. If run and the result is unexpected, record and triage it normally.
- If an expected status/code differs, mark `FAIL`, retain evidence, create a defect report, and stop any remaining destructive steps on that object.

---

## UAT-01 — Normal journey, receipts and aggregate calculation

| Field | Detail |
|---|---|
| **Purpose** | Complete a real user journey: Owner creates/publishes, two Respondents submit, receipts persist, and Owner summary calculates exact counts without exposing respondent identity. |
| **Requirement / AC** | F-01 `AC-F01-01`, `AC-F01-03`; F-02 `AC-F02-01`, `AC-F02-02`, `AC-F02-06`; F-03 `AC-F03-01`..`03`, `AC-F03-10`; F-04 `AC-F04-01`. |
| **Roles** | Owner-1, Resp-1, Resp-2. |
| **Preconditions** | Release and health are confirmed; all three accounts can sign in; no survey with this run's unique title exists. |
| **Synthetic data** | Title `UAT-<TEAM>-<RUN>-J01`; description `Synthetic Sprint 1 acceptance journey`; Q1 required `SINGLE_CHOICE`: `How clear was the guide?` options `Clear`, `Needs work`; Q2 optional `SHORT_TEXT`: `One suggestion`; Resp-1 answer `Keep examples concise.` |

| Step | User action | Expected result |
|---|---|---|
| 1 | Sign in as Owner-1. Open `/owner/surveys`. | Login succeeds and redirects to the owner survey list. The displayed role is `SURVEY_OWNER`; the owner list is available. |
| 2 | Click **+ New Survey**. Enter the title/description above. Add Q1 and Q2 with the stated types/required settings/options. Click **Publish Survey**. | Survey is saved as `PUBLISHED`; the owner list shows the title, 2 questions and 0 responses. Record its survey ID from the summary link. |
| 3 | Log out. Sign in as Resp-1. Open `/surveys`, start the new survey, select `Clear`, enter `Keep examples concise.`, and submit. | Survey appears as `Not submitted`; the form has the expected question types/options. Submission succeeds once; receipt says **Your response is recorded** and shows the submitted values and timestamp. Record Resp-1's response ID/receipt URL. |
| 4 | Log out. Sign in as Resp-2. Start the same survey, select `Needs work`, leave the optional Q2 blank, and submit. | Submission succeeds once. Receipt shows `Needs work`. The optional question can be omitted. Record Resp-2's response ID. |
| 5 | As Resp-2, reload the receipt, return to `/surveys`, and reopen **View receipt**. | The response ID, answer and submitted timestamp persist. The survey is marked **Completed**; the respondent cannot start a second normal submission and sees **View receipt**. |
| 6 | Log in as Owner-1 and open **View summary** for the survey. | `Total responses: 2`. Q1: `2 answered`; `Clear: 1 (50%)`, `Needs work: 1 (50%)`. Q2: `1 answered`; its text list contains exactly `Keep examples concise.`. The optional blank from Resp-2 does not count as an answer. No name, email, user ID or response ID is shown in the summary. |
| 7 | With Owner-1 signed in, use `uatRequest` for `/api/auth/me` and `/api/surveys/${surveyId}/summary`. | `/me` returns HTTP `200` with Owner-1 identity/role and no `passwordHash`; summary returns HTTP `200`, with the same totals and no respondent identity fields. |

**Evidence to capture:** `EVID-UAT-01-01` published survey/list; `EVID-UAT-01-02` receipt after reload (use Resp-1 or Resp-2); `EVID-UAT-01-03` owner summary showing the values above and no identity data.

---

## UAT-02 — Draft authoring, publish rules and lifecycle boundaries

| Field | Detail |
|---|---|
| **Purpose** | Verify draft create/read/update/delete, server-side publish validation, legal lifecycle transitions, and that a published/closed survey cannot be edited or reopened. |
| **Requirement / AC** | F-02 `AC-F02-02`..`AC-F02-08`, `AC-F02-10`, `AC-F02-11`; F-03 `AC-F03-05` for a closed form. |
| **Roles** | Owner-1; a logged-out/Respondent browser for the final closed-form check. |
| **Preconditions** | Use a fresh title; do not use the seeded `Internal Team Survey Draft`. |
| **Synthetic data** | Main title `UAT-<TEAM>-<RUN>-J02`; temporary delete title `UAT-<TEAM>-<RUN>-DELETE`; question `Pick one`; options `Alpha`, `Beta`; revised title `UAT-<TEAM>-<RUN>-J02-Edited`. |

| Step | User action | Expected result |
|---|---|---|
| 1 | As Owner-1 create a survey with the main title and no questions. Click **Save Draft**. | Draft is created and listed with `DRAFT` status. Record its survey ID. |
| 2 | As Owner-1 click **Edit** for the draft, then click **Publish Survey** without adding a question. **Optional API supplement:** as Owner-1 call `PATCH /api/surveys/${surveyId}/publish` and `PATCH /api/surveys/${surveyId}/close` separately. In a Resp-1 session check `/surveys`; **optional API supplement:** call `GET /api/surveys/${surveyId}/form` and `GET /api/surveys/active` with `uatRequest`. Do not open `/surveys/active` or an `/api/...` path in the address bar. | The editor explains that at least one question is required and remains a draft. If the optional calls are run: publish returns HTTP `400`, `INVALID_QUESTION_STRUCTURE`; close returns HTTP `400`, `INVALID_STATE_TRANSITION`; status remains `DRAFT`; the respondent form returns HTTP `400`, `SURVEY_NOT_ACCEPTING_RESPONSES`; the draft is absent from active surveys. |
| 3 | In **Edit**, add a required single-choice question (the editor creates two option rows). Enter a prompt and `Alpha` in the first option; leave the second option blank. Click **Save Draft**, then click **Publish Survey**. | The editor shows `Invalid survey structure.` with an option-field error, and the survey remains `DRAFT`. The Save Draft `PUT` response is HTTP `400`, `VALIDATION_ERROR`; confirm the status/code in DevTools Network if recording API details (inspect the response only; do not capture request headers or payload). The editor then blocks Publish and identifies the empty option. This checks the UI-reachable validation; do not report that a one-option survey was created through the UI. |
| 4 | Enter valid prompt/options `Same` and ` same `, then click **Save Draft**. | The editor shows `Invalid survey structure.` with a duplicate-option field error. The Save Draft `PUT` response is HTTP `400`, `VALIDATION_ERROR` because labels are duplicates after trimming/case-folding; confirm the status/code in DevTools Network if recording API details (inspect the response only; do not capture request headers or payload). The survey remains `DRAFT`; no duplicate-option survey is published. |
| 5 | Correct the draft to Q1 `Pick one` with `Alpha`/`Beta`; set description to `Edited synthetic description`; click **Save Draft**. From the owner list click **Edit**, change the title to the revised title and prompt to `Pick one - revised`, then click **Save Draft** again. | After each save, the app returns to `/owner/surveys`. Reopening **Edit** shows the revised title, description and prompt/options after reload. Only the latest valid values remain. |
| 6 | From `/owner/surveys`, click **Publish** for the corrected draft. **Optional API supplement:** as Owner-1 use `uatRequest` to get `/api/surveys/${surveyId}`. | Status becomes `PUBLISHED`; the owner list shows `PUBLISHED`, with no **Edit** or **Delete** action. If the optional API call is run, it returns HTTP `200` with `publishedAt` and the ordered question/options. |
| 7 | **Optional API supplement:** as Owner-1 call `PUT /api/surveys/${surveyId}` with the valid replacement body below, then `DELETE /api/surveys/${surveyId}`, then `PATCH /api/surveys/${surveyId}/publish`. Run each call separately and stop after any unexpected success. | If run, update/delete return HTTP `400`, `SURVEY_NOT_EDITABLE`; republish returns HTTP `400`, `INVALID_STATE_TRANSITION`. Title, status and question structure remain unchanged. |
| 8 | Create another temporary draft with one valid single-choice question and the delete title, save it, then use **Delete** and confirm in the dialog. | Draft is removed from Owner-1's list. This confirms a draft with question/option data can be deleted. Record the deleted draft ID/title in notes. |
| 9 | As Owner-1 click **Close** on the main survey and confirm **Close Survey**. | Status becomes `CLOSED`; the app says it cannot be reopened. The survey remains visible to its owner for summary, with no edit/delete/close action. |
| 10 | As Resp-1, navigate in the app to `/surveys/${surveyId}/take`. **Optional API supplement:** call `GET /api/surveys/${surveyId}/form` with `uatRequest`. As Owner-1, **optional API supplement:** repeat the publish/close/update/delete calls from Step 7 against the now-closed survey, one at a time. Never open `/api/...` in the address bar. | The respondent cannot use a valid form to submit. If the optional API calls are run, the form returns HTTP `400`, `SURVEY_NOT_ACCEPTING_RESPONSES`; publish/close return HTTP `400`, `INVALID_STATE_TRANSITION`; update/delete return HTTP `400`, `SURVEY_NOT_EDITABLE`. The main survey stays `CLOSED` and unchanged. |

**Valid replacement body for steps 7 and 10:**

```json
{"title":"UAT replacement attempt","description":"Synthetic only","questions":[{"prompt":"Replacement question","questionType":"SINGLE_CHOICE","isRequired":true,"options":[{"label":"A"},{"label":"B"}]}]}
```

**Optional API-only one-option publish boundary:** The editor cannot create a one-option single-choice question. If the UAT Team wants to verify the server rule directly, run each call separately as Owner-1, using a unique title. Capture the returned draft ID; after confirming publish is rejected and the draft remains `DRAFT`, delete this temporary draft. Stop before cleanup if publish unexpectedly succeeds.

```js
const oneOptionDraft = await uatRequest('/api/surveys', 'POST', {
  title: 'UAT-<TEAM>-<RUN>-ONE-OPTION',
  description: 'Synthetic API-only boundary check',
  questions: [{
    prompt: 'Pick one',
    questionType: 'SINGLE_CHOICE',
    isRequired: true,
    options: [{ label: 'Only option' }]
  }]
});
const oneOptionSurveyId = oneOptionDraft.data.data.id;
```

Run publish separately, then check that the status remains `DRAFT`:

```js
await uatRequest(`/api/surveys/${oneOptionSurveyId}/publish`, 'PATCH');
```

Only after confirming it remains `DRAFT`, run cleanup separately:

```js
await uatRequest(`/api/surveys/${oneOptionSurveyId}`, 'DELETE');
```

Expected for the optional API boundary: create returns HTTP `201`; publish returns HTTP `400`, `INVALID_QUESTION_STRUCTURE` (detail code `TOO_FEW_OPTIONS`); the draft remains `DRAFT` until cleanup.

**Evidence to capture:** `EVID-UAT-02-01` invalid empty-survey publish and unchanged `DRAFT`; `EVID-UAT-02-02` UI option validation (and optional one-option API result, if run); `EVID-UAT-02-03` edited/published survey and forbidden lifecycle transitions; `EVID-UAT-02-04` deleted temporary draft no longer listed.

---

## UAT-03 — Required answers, type/length validation, duplicate and closed submission

| Field | Detail |
|---|---|
| **Purpose** | Verify the respondent sees useful validation, invalid payloads do not create responses, one response is accepted, duplicate submissions are rejected, and closing prevents further submissions. |
| **Requirement / AC** | F-03 `AC-F03-02`..`AC-F03-07`; F-02 `AC-F02-08`. |
| **Roles** | Owner-1 and Resp-1. |
| **Preconditions** | Create a new survey so Resp-1 has not submitted to it. |
| **Synthetic data** | Title `UAT-<TEAM>-<RUN>-J03`; Q1 required `SINGLE_CHOICE`: `Choose one`, options `Alpha`, `Beta`; Q2 required `SHORT_TEXT`: `Short explanation`. Valid final answer: `Alpha` + `Synthetic response.` |

| Step | User action | Expected result |
|---|---|---|
| 1 | As Owner-1 create and publish the survey with Q1/Q2 above. | Status is `PUBLISHED`; owner list shows 0 responses. Record survey ID. |
| 2 | Sign in as Resp-1, open the survey and click **Submit response** with both questions empty. **Optional API supplement:** call `POST /api/surveys/${surveyId}/responses` with `{"answers":[]}` using `uatRequest`. | The required fields block UI submission and show **This question is required.** (or equivalent contract validation); no response is created. If the API supplement is run, it returns HTTP `400`, `MISSING_REQUIRED_QUESTIONS`, with both required question IDs in `error.details.questionIds`. Owner list still shows 0 responses. |
| 3 | **Optional API supplement:** as Resp-1 fetch the form with the helper, then submit Q1 valid and Q2 with 2,001 `x` characters as described in the accompanying API reference. | If run, HTTP `400`, `INVALID_ANSWER`; no response/claim is created. Owner list still shows 0 responses. |
| 4 | **Optional API supplement:** send one additional wrong-type payload for the same fresh survey: put `selectedOptionIds` on Q2 (`SHORT_TEXT`) while Q1 has a valid selected option. | If run, HTTP `400`, `INVALID_ANSWER`; no response is created. Stop and report if it succeeds. |
| 5 | In the UI answer Q1 `Alpha` and Q2 `Synthetic response.`; submit once. | Submission succeeds and receipt shows both values. Owner list now shows exactly 1 response. The form's short-text counter/limit is 2,000 characters. |
| 6 | Reopen `/surveys/${surveyId}/take` as Resp-1, choose `Beta` and another text, and submit again. **Optional API supplement:** send a second valid `POST /api/surveys/${surveyId}/responses` with `uatRequest`. | UI reports **You have already submitted a response to this survey.** If the API supplement is run, it returns HTTP `409`, `DUPLICATE_SUBMISSION`. Owner count remains 1 and the original receipt is unchanged. |
| 7 | As Owner-1 close this survey. As Resp-1 navigate in the UI to `/surveys/${surveyId}/take`. **Optional API supplement:** call `GET /api/surveys/${surveyId}/form` with `uatRequest`. | The UI does not offer a valid submission form. If the API supplement is run, it returns HTTP `400`, `SURVEY_NOT_ACCEPTING_RESPONSES`. Response count and the original receipt remain unchanged. |

**Evidence to capture:** `EVID-UAT-03-01` missing-required feedback and 0 responses; `EVID-UAT-03-02` over-limit/wrong-type rejection status with no token shown; `EVID-UAT-03-03` one successful receipt; `EVID-UAT-03-04` duplicate rejection plus count unchanged; `EVID-UAT-03-05` closed form rejection.

**UAT limitation:** this manual case checks sequential duplicate attempts. The contract's concurrent two-request race check is an engineering/API suite check, not a result to claim from this manual UAT.

---

## UAT-04 — Role, ownership and response privacy

| Field | Detail |
|---|---|
| **Purpose** | Check role restrictions, other-owner isolation, cross-respondent receipt denial, and that rejected actions disclose no protected data or change state. |
| **Requirement / AC** | F-01 `AC-F01-08`, `AC-F01-09`; F-02 `AC-F02-09`; F-03 `AC-F03-08`, `AC-F03-09`; F-04 `AC-F04-02`, `AC-F04-03`. |
| **Roles** | Resp-1, Resp-2, Owner-1, Owner-2. |
| **Preconditions** | UAT-01 has produced its survey ID and Resp-1 receipt ID; UAT-02 has produced its closed test survey ID. The seeded Owner-2 survey is `00000000-0000-4000-a000-000000000003`. |
| **Synthetic inputs / data to record** | Use the UAT-01 survey and Resp-1 receipt IDs, the UAT-02 survey ID, and synthetic forbidden-attempt title/body below. The Owner-2 seed ID is read-only. Record before/after status and response count. |

| Step | User action | Expected result |
|---|---|---|
| 1 | In a logged-out tab, confirm there is no token, then use `uatRequest` for `GET /api/auth/me` and `POST /api/auth/logout`. | Both return HTTP `401`, `TOKEN_REQUIRED`; no identity/session data is returned. |
| 2 | Sign in as Resp-1. Call `GET /api/surveys` and `POST /api/surveys` with `{"title":"UAT-<TEAM>-<RUN>-FORBIDDEN","description":"Synthetic only","questions":[]}`. Try opening `/owner/surveys`. | Owner-only API requests return HTTP `403`, `FORBIDDEN_ROLE`, with no owner survey data and no survey created. The UI redirects Resp-1 to `/surveys`. |
| 3 | Log out and sign in as Owner-1. Open `/surveys`; then call `POST /api/surveys/${uat01SurveyId}/responses` with `{"answers":[]}`. | The UI redirects Owner-1 to `/owner/surveys`. The API call returns HTTP `403`, `FORBIDDEN_ROLE`; response count and both existing receipts remain unchanged. |
| 4 | Log out and sign in as Resp-2. Open Resp-1's receipt URL from UAT-01. Then return to `/surveys` and open Resp-2's own **View receipt**. Also call `GET /api/surveys/${uat01SurveyId}/responses/${resp1ResponseId}`. | Resp-2 cannot view Resp-1's receipt or answers; the UI shows an error and the API returns HTTP `403`, `FORBIDDEN_CROSS_RESPONSE_ACCESS`, with no answer values. Resp-2 still sees UAT-01 as **Completed** and can view only Resp-2's own receipt and answers. |
| 5 | Log out and sign in as Owner-2. Call `GET /api/surveys` first; then, against the UAT-02 survey, call `GET`, `PUT` (with the valid replacement body below), `PATCH /publish`, `PATCH /close`, and finally `DELETE`. Run each call separately. | Owner-2's list contains Owner-2's own survey and not UAT-02. Every operation on UAT-02 returns HTTP `403`, `FORBIDDEN_OWNERSHIP`. If any call succeeds or returns a different code, stop before the next mutating call and record a defect. |
| 6 | Log out and sign in as Owner-1. Call `GET /api/surveys`, then use `uatRequest` to call `GET /api/surveys/${uat02SurveyId}` and compare its title/status/questions with the recorded values. In the UI, use **View summary** for the closed UAT-02 survey. Call the summary API for Owner-2's seeded survey and open its summary route. | Owner-1's list contains UAT-02 and omits Owner-2's seed. The closed UAT-02 survey remains readable and unchanged; it has no edit/reopen action. Owner-2 summary returns HTTP `403`, `FORBIDDEN_OWNERSHIP`; UI displays **Access Denied** without statistics. Do not use the seeded survey for any write/response operation. |
| 7 | Log out and sign in as Owner-2. Reopen `/owner/surveys` and check the seeded `Owner 2 Course Pulse` record. | The seed still appears as `PUBLISHED`. This is a read-only fixture check; do not send a write request to the seeded survey. |
| 8 | As Resp-1 call summary API for the UAT-01 survey. | HTTP `403`, `FORBIDDEN_ROLE`; no totals or response data are returned. |

Use this valid synthetic body for the other-owner `PUT` check in step 5. Substitute the run code; it is intended to be rejected and must never replace the UAT-02 survey:

```json
{"title":"UAT-<TEAM>-<RUN>-FORBIDDEN-UPDATE","description":"Synthetic only","questions":[{"prompt":"Ownership check","questionType":"SINGLE_CHOICE","isRequired":true,"options":[{"label":"A"},{"label":"B"}]}]}
```

Run the Owner-2 calls one at a time, replacing the angle-bracket values with UUIDs recorded in the execution log. Do not paste/run all lines as a batch. Inspect each status and stop after any unexpected success before issuing another mutation:

```js
await uatRequest('/api/surveys/<UAT-02-SURVEY-ID>');
await uatRequest('/api/surveys/<UAT-02-SURVEY-ID>', 'PUT', {
  title: 'UAT-<TEAM>-<RUN>-FORBIDDEN-UPDATE',
  description: 'Synthetic only',
  questions: [{
    prompt: 'Ownership check', questionType: 'SINGLE_CHOICE', isRequired: true,
    options: [{ label: 'A' }, { label: 'B' }]
  }]
});
await uatRequest('/api/surveys/<UAT-02-SURVEY-ID>/publish', 'PATCH');
await uatRequest('/api/surveys/<UAT-02-SURVEY-ID>/close', 'PATCH');
await uatRequest('/api/surveys/<UAT-02-SURVEY-ID>', 'DELETE');
```

For Step 4, use `GET /api/surveys/<UAT-01-SURVEY-ID>/responses/<RESP-1-RESPONSE-ID>` as Resp-2. For Step 6, use `GET /api/surveys/00000000-0000-4000-a000-000000000003/summary` as Owner-1. Do not send a write request to the seeded Owner-2 survey. The `DELETE` in Step 5 is expected to fail with `403 FORBIDDEN_OWNERSHIP`; record its status and error code, and stop if it unexpectedly succeeds.

**Evidence to capture:** `EVID-UAT-04-01` no-token 401 checks; `EVID-UAT-04-02` role-denied API response; `EVID-UAT-04-03` cross-receipt denial with answer data absent; `EVID-UAT-04-04` ownership denial and unchanged state; `EVID-UAT-04-05` summary access denied with no statistics.

---

## UAT-05 — Logout revocation and persisted history

| Field | Detail |
|---|---|
| **Purpose** | Verify a prior token is revoked on logout and a submitted response/receipt/summary survives reload and a fresh login. |
| **Requirement / AC** | F-01 `AC-F01-04`, `AC-F01-05`; F-03 `AC-F03-10`; F-04 `AC-F04-01`. |
| **Roles** | Resp-1, then Owner-1. |
| **Preconditions** | UAT-01 has a submitted Resp-1 response and a recorded receipt URL. Do not close UAT-01's survey until this case is done. |
| **Synthetic data / IDs to record** | Use Resp-1's synthetic response from UAT-01. Record the survey/response IDs, submitted answers/timestamp and observed release. Never record a token value. |

| Step | User action | Expected result |
|---|---|---|
| 1 | Sign in as Resp-1 in a fresh browser session. Open `/surveys` and click **View receipt** for UAT-01. | Survey is marked `Completed`; same receipt/answers from UAT-01 are present after a new login. |
| 2 | In DevTools run `void (window.__uatOldToken = localStorage.getItem('token'));` so the expression does not echo its value. Click **Log out**. | Redirects to `/login`; `localStorage.getItem('token')` is `null`. The old token remains only in the page's in-memory variable until Step 3. |
| 3 | Replay only the stored in-memory token using the safe snippet in the accompanying API reference. | HTTP `401`, `TOKEN_REVOKED`. Delete `window.__uatOldToken` after the check. Never capture the token or Authorization header. |
| 4 | Sign in again as Resp-1, reload the receipt, and compare response ID, timestamp and answers with UAT-01. | Same response and content persist. No second response appears. |
| 5 | Sign in as Owner-1 and open the UAT-01 summary. | Summary still has 2 responses, Q1 counts 1/1, Q2 answeredCount 1 and the same synthetic text as UAT-01. |

**Evidence to capture:** `EVID-UAT-05-01` receipt after fresh login; `EVID-UAT-05-02` logged-out state and `TOKEN_REVOKED` status/code with token hidden; `EVID-UAT-05-03` owner summary after re-login.

**Scope note:** this verifies persisted data through reload and a fresh authenticated session on the deployed service. Do not claim that the UAT Team restarted Cloud Run/Cloud SQL unless that was actually part of an approved separate exercise.

---

## UAT-06 — Zero-response summary and optional unanswered question

| Field | Detail |
|---|---|
| **Purpose** | Verify an empty summary renders cleanly, then verify option counts and an unanswered optional question after one response. |
| **Requirement / AC** | F-04 `AC-F04-01`, `AC-F04-04`; F-03 `AC-F03-03`, `AC-F03-06`. |
| **Roles** | Owner-1, Resp-2. |
| **Preconditions** | Use a fresh survey; the respondent has not submitted to it. |
| **Synthetic data** | Title `UAT-<TEAM>-<RUN>-J06`; required single-choice Q `Choose one` with `Alpha`/`Beta`; optional short-text Q `Optional note`. |

| Step | User action | Expected result |
|---|---|---|
| 1 | As Owner-1 create/publish the survey and open **View summary**. **Optional API supplement:** call the summary API with `uatRequest`. | UI says **No responses submitted yet**; `totalResponses=0`; each question has `answeredCount=0`; option counts/percentages are 0; short-text list is empty. If the API supplement is run, it returns HTTP `200` with the corresponding zero counts. |
| 2 | Sign in as Resp-2, submit `Alpha` and leave optional text blank. | Submission succeeds once; receipt confirms the choice. |
| 3 | Sign in as Owner-1 and reload the summary. | `totalResponses=1`; choice question `answeredCount=1`, `Alpha=1 (100%)`, `Beta=0 (0%)`; optional text `answeredCount=0` and no text answers. Summary contains no respondent identity. |
| 4 | Close the temporary survey after capturing evidence. | It is `CLOSED` and no longer accepts responses. |

**Evidence to capture:** `EVID-UAT-06-01` zero-response state; `EVID-UAT-06-02` summary after one response and optional omission.

---

## UAT-07 — Invalid login, malformed input and unauthenticated access

| Field | Detail |
|---|---|
| **Purpose** | Verify login rejects invalid credentials and malformed input without disclosing account existence or returning a token/password field. |
| **Requirement / AC** | F-01 `AC-F01-01`, `AC-F01-02`, `AC-F01-06` (API response only), `AC-F01-07`, `AC-F01-08`. |
| **Roles** | Logged-out tester; Owner-1 only for the valid-identity response comparison. |
| **Preconditions** | Start with a logged-out browser tab with no token; use the agreed public deployed URL; do not include the real test password in evidence. |
| **Synthetic inputs** | Wrong password literal `not-a-real-password`; malformed email `not-an-email`; missing-field body `{}`. |

| Step | User action | Expected result |
|---|---|---|
| 1 | On `/login`, try `owner1@survey.local` with `not-a-real-password`, then `unknown@survey.local` with the same synthetic password. | Both attempts show **Invalid email or password.** No session is created and no token is stored after either attempt; the UI does not reveal whether the account exists. |
| 2 | While logged out, call `POST /api/auth/login` with `{"email":"not-an-email","password":"synthetic-only"}`, then with `{}` using `uatRequest`. | Both return HTTP `400`, `VALIDATION_ERROR`, with field-level details and no submitted values echoed in the response. For `{}`, `sensitiveFieldsPresent` may list `error.details.password`; this is the name of a validation field, while its value is redacted as `[REDACTED]`. No token is returned. |
| 3 | While logged out, call `POST /api/auth/login` with valid-format `owner1@survey.local` and `not-a-real-password` using `uatRequest`. | HTTP `401`, `INVALID_CREDENTIALS`; no token and no `passwordHash`. |
| 4 | Sign in successfully as Owner-1 through `/login`. Then run `await uatLoginCheck('owner1@survey.local')` and enter the password only in its masked dialog, not in the Console command. Finally run `await uatRequest('/api/auth/me')`. | The login helper returns the sanitized API login response; `sensitiveFieldsPresent` includes `data.token` but not `password` or `passwordHash`. `/me` returns stored identity/role and no sensitive field names. Do not screenshot the dialog contents, token values or Network Authorization header. |

**Evidence to capture:** `EVID-UAT-07-01` generic invalid-credential UI; `EVID-UAT-07-02` malformed-input response with submitted values absent; `EVID-UAT-07-03` response field review with token/hash hidden.

---

## Coverage map

The map records which manual UAT case observes each Sprint 1 acceptance criterion. A criterion may have more detailed engineering-only assertions in the Sprint 1 contract/test suite.

| Feature | Sprint 1 acceptance criteria | UAT case(s) |
|---|---|---|
| F-01 | `AC-F01-01`..`AC-F01-09` | UAT-01, UAT-04, UAT-05, UAT-07 |
| F-02 | `AC-F02-01`..`AC-F02-11` | UAT-01, UAT-02, UAT-04 |
| F-03 | `AC-F03-01`..`AC-F03-10` | UAT-01, UAT-02, UAT-03, UAT-04, UAT-05, UAT-06 |
| F-04 | `AC-F04-01`..`AC-F04-04` | UAT-01, UAT-04, UAT-05, UAT-06 |

For `AC-F03-04`, the UAT case checks sequential duplicate behavior; the contract's simultaneous-request guarantee still needs engineering evidence. For `AC-F01-06`, manual checks verify API responses contain no password/hash fields; database hash-format verification is not exposed to UAT and must not be claimed from this pack. The four seeded accounts provide at most two respondent submissions per survey, so a percentage such as 1/3 (33.33%) cannot be manually observed from this pack. If an authorized third synthetic respondent is provided, record it as an added case/input; otherwise leave two-decimal rounding as engineering evidence and do not claim the manual UAT verified that branch.
