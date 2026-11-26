# Lab 6 — UAT exercise results: Worawut

## UAT Cases — Build a0b6afa

- **Test date:** 2026-11-26
- **URL:** [controlled defect build](https://lab6uat---approval-flow-rdaxzekvca-as.a.run.app/)
- **Build:** The application footer showed Build a0b6afa during the run.
- **Scope:** UAT-01, UAT-02, and UAT-04 through UAT-12 were retested in this run. UAT-03 was not repeated because its prior controlled-build retest had already recorded a failure; that FAIL result is carried forward below.
- **Tester:** Codex, at Worawut's request.

| Case | Build | Latest recorded result |
| --- | --- | --- |
| UAT-01 | a0b6afa | PASS |
| UAT-02 | a0b6afa | PASS |
| UAT-03 | a0b6afa | FAIL — prior retest; not repeated in this run |
| UAT-04 | a0b6afa | PASS |
| UAT-05 | a0b6afa | PASS |
| UAT-06 | a0b6afa | PASS |
| UAT-07 | a0b6afa | PASS |
| UAT-08 | a0b6afa | PASS |
| UAT-09 | a0b6afa | PASS |
| UAT-10 | a0b6afa | PASS |
| UAT-11 | a0b6afa | PASS |
| UAT-12 | a0b6afa | PASS |

### Fresh retest details

#### UAT-01 — PASS

- **Input / steps:** Ploy submitted a request for THB 1,250.50 to Mint; Mint approved it.
- **Expected / actual:** The request should be submitted and move to Approved after reviewer action. REQ-000055 appeared in My Requests and showed Approved after Mint's decision.

**Evidence:**

![submitted request](evidence/E-UAT-01-01-Codex-submitted.png)

![approved request](evidence/E-UAT-01-02-Codex-approved.png)

#### UAT-02 — PASS

- **Input / steps:** Ploy submitted THB 8,000 to Mint. Mint rejected it with the reason “Please get a second quotation.”
- **Expected / actual:** The request should show the rejection and its reason. REQ-000056 showed Rejected in My Requests.

**Evidence:**

![rejected request](evidence/E-UAT-02-01-Codex-rejected.png)

#### UAT-03 — FAIL (prior controlled-build retest)

UAT-03 was not repeated in this run. The prior controlled-build retest recorded a failure because the inclusive maximum amount was rejected; see the detailed results below.

#### UAT-04 — PASS

- **Input / steps:** Ploy submitted a THB 10,000 request to Mint. On the reviewer form, blank and whitespace-only rejection reasons were tried; approval was then submitted with a blank reason.
- **Expected / actual:** Blank and whitespace-only rejection reasons should be blocked; approval should not require a rejection reason. Both rejection attempts showed validation, and the blank-reason approval succeeded for REQ-000057.

**Evidence:**

![blank reason validation](evidence/E-UAT-04-01-Codex-empty-reason-validation.png)

![whitespace validation](evidence/E-UAT-04-02-Codex-whitespace-validation.png)

![approval with blank reason](evidence/E-UAT-04-03-Codex-blank-reason-approved.png)

#### UAT-05 — PASS

- **Input / steps:** Empty required fields were submitted; a 121-character title was tried, then a 120-character title; the literal string <script>alert(1)</script> was also submitted.
- **Expected / actual:** Required fields and over-limit title should be rejected; the 120-character boundary should be accepted; HTML-like input should display as text. The empty fields and 121-character title were rejected, the 120-character title was accepted as REQ-000058, and the literal string was displayed as text in REQ-000059.

**Evidence:**

![required fields](evidence/E-UAT-05-01-Codex-required-fields.png)

![title over limit](evidence/E-UAT-05-02-Codex-title-over-limit.png)

![title at limit](evidence/E-UAT-05-03-Codex-title-at-limit.png)

![literal HTML text](evidence/E-UAT-05-04-Codex-literal-html.png)

#### UAT-06 — PASS

- **Account / steps:** Ploy, Requester. Checked the menu and direct /reviews page, then opened /api/reviews/inbox while signed in. After logging out, opened /requests and both /api/reviews/inbox and /api/requests/mine.
- **Expected / actual:** A requester should not reach reviewer functions; signed-out pages should not show request data. The menu had no Review Inbox entry, /reviews showed “This page is not available to you.”, and the signed-in inbox API returned FORBIDDEN (403). Signed-out /requests showed the login page, while both APIs returned UNAUTHENTICATED (401).

**Evidence:**

![requester menu](evidence/E-UAT-06-01-Codex-requester-menu.png)

![review page denied](evidence/E-UAT-06-02-Codex-reviews-denied.png)

![signed-in inbox 403](evidence/E-UAT-06-03-Codex-forbidden-403.png)

![signed-out inbox 401](evidence/E-UAT-06-04-Codex-signed-out-inbox-401.png)

![signed-out My Requests API 401](evidence/E-UAT-06-05-Codex-signed-out-mine-401.png)

#### UAT-07 — PASS

- **Input / steps:** Ploy created REQ-000060 for THB 700, assigned to Mint. Nattapong checked My Requests and the request URL/API; Korn checked the same request as an unassigned reviewer; Mint opened it as the assigned reviewer.
- **Expected / actual:** Other requesters and unassigned reviewers should not see request details, while the assigned reviewer should have decision controls. Nattapong and Korn saw an unavailable page and a NOT_FOUND (404) response. Mint saw the assigned request and decision panel.

**Evidence:**

![requester unavailable page](evidence/E-UAT-07-01-Codex-REQB-unavailable-404.png)

![requester 404](evidence/E-UAT-07-02-Codex-REQB-not-found-404.png)

![unassigned reviewer page](evidence/E-UAT-07-03-Codex-REVB-unavailable-404.png)

![unassigned reviewer 404](evidence/E-UAT-07-04-Codex-REVB-not-found-404.png)

![assigned reviewer panel](evidence/E-UAT-07-05-Codex-Mint-assigned-panel.png)

#### UAT-08 — PASS

- **Input / steps:** Mint opened New Request and reviewed the available reviewers, then submitted REQ-000061 for THB 500 with Korn selected.
- **Expected / actual:** Mint should not be able to assign a request to themself, and the selected reviewer should receive the request. The reviewer list offered Korn without Mint; Mint's request detail had no decision controls, while Korn's inbox and detail showed the request and decision panel.

**Evidence:**

![reviewer options](evidence/E-UAT-08-01-Codex-reviewer-options.png)

![Mint's request detail](evidence/E-UAT-08-02-Codex-Mint-request-detail.png)

![Korn's inbox](evidence/E-UAT-08-03-Codex-Korn-inbox.png)

![Korn's decision panel](evidence/E-UAT-08-04-Codex-Korn-decision-panel.png)

#### UAT-09 — PASS

- **Input / steps:** Ploy created REQ-000062 for THB 900, assigned to Mint. Mint rejected it with “Not in this quarter's budget.” Ploy signed out and back in, then reloaded history.
- **Expected / actual:** The reviewer inbox should no longer offer a decided request; the requester should see a persistent decision and reason without edit/delete controls. Mint's inbox no longer listed REQ-000062; its detail showed Rejected, and Ploy's reloaded history showed Submitted and Rejected by Mint with the exact reason.

**Evidence:**

![Mint inbox after rejection](evidence/E-UAT-09-01-Codex-Mint-inbox-after-rejection.png)

![reviewer decision history](evidence/E-UAT-09-02-Codex-Mint-rejected-history.png)

![Ploy's reloaded history](evidence/E-UAT-09-03-Codex-Ploy-history-reloaded.png)

#### UAT-10 — PASS

- **Input / steps:** Ploy created REQ-000063 for THB 6,700. Mint opened it in two tabs, approved in the first, then tried to reject from the stale second tab with reason “Stale tab conflict.”
- **Expected / actual:** A stale tab should not apply a second decision. The second tab showed “This request has already been decided.” and refreshed to Approved with no decision controls. Reloaded history contained one approval only; Ploy also saw one Approved result.

**Evidence:**

![stale rejection blocked](evidence/E-UAT-10-01-Codex-stale-reject-blocked.png)

![approved after reload](evidence/E-UAT-10-02-Codex-approved-after-reload.png)

![single approval for Ploy](evidence/E-UAT-10-03-Codex-Ploy-single-approval.png)

#### UAT-11 — PASS

- **Input / steps:** The empty sign-in form was submitted. Ploy then signed in with an email containing uppercase characters and trailing whitespace; the page was reloaded. After sign-out, a known account with an incorrect password and an unknown email were compared. Mint signed in last.
- **Expected / actual:** Empty fields should show validation; email normalization and session persistence should work; known and unknown accounts should show the same generic error; a reviewer should land in the inbox. The empty form showed both required-field errors, Ploy remained signed in after reload, both invalid-account cases showed “Email or password is incorrect.”, and Mint landed in Review Inbox.

**Evidence:**

![empty form errors](evidence/E-UAT-11-01-Codex-empty-form-errors.png)

![signed-out request route](evidence/E-UAT-11-02-Codex-requests-redirect-login.png)

![known account error](evidence/E-UAT-11-03-Codex-known-account-wrong-password.png)

![unknown account error](evidence/E-UAT-11-04-Codex-unknown-email-same-message.png)

![Mint inbox](evidence/E-UAT-11-05-Codex-Mint-lands-inbox.png)

#### UAT-12 — PASS

- **Time / build:** 2026-11-26, approximately 02:51 Asia/Bangkok; Build a0b6afa.
- **Input / steps:** Signed out and tested REQ-B (Nattapong) with an incorrect password. The first visible invalid submission and the next explicit submission showed “Email or password is incorrect.” A later submission displayed a temporary lockout of 10 minutes. A correct-password submission was then attempted; the login page remained locked. Ploy was signed in during the same lockout.
- **Expected:** After repeated failed sign-in attempts, REQ-B should be locked for no more than 15 minutes; a correct password should not bypass the lockout, while Ploy should still be able to sign in.
- **Actual / result:** The lockout message said “Too many sign-in attempts. Try again in 10 minutes,” within the 15-minute limit. The correct-password attempt remained locked, and Ploy successfully opened My Requests during the lockout. The teammate confirmed that this 10-minute wait is correct UAT-12 behavior. The browser-control tool timed out during the repeated-attempt sequence, so the exact number of failed attempts was not recorded.

**Evidence:**

![REQ-B lockout after correct-password attempt](evidence/E-UAT-12-02-Codex-REQB-locked-10min.png)

![Ploy access during lockout](evidence/E-UAT-12-03-Codex-Ploy-access-during-lockout.png)

### Evidence provenance

The directory contains fresh screenshots for the 2026-11-26 retest except for the existing UAT-03 image, which documents the previously recorded UAT-03 failure. UAT-12 has two screenshots: the lockout message and Ploy's successful access during that lock. Evidence limits are stated in the case notes above. No application source code or diff was inspected.

### UAT-03 — Maximum amount boundary (initial controlled-build run)

- **Result:** FAIL (reproduced twice)
- **Tester / time:** Worawut; 2026-11-25 approximately 23:52 Asia/Bangkok (exact submission timestamp was not retained)
- **Build / URL:** `a0b6afa` — [controlled defect build](https://lab6uat---approval-flow-rdaxzekvca-as.a.run.app/)
- **Steps and input:** On New Request, enter title `UAT-03 maximum 2026-11-25`, description `Maximum amount boundary test`, amount `1000000.00` THB, and select Mint Chaiyaporn as reviewer; submit. Repeat once with the same boundary amount.
- **Expected:** The inclusive maximum boundary `1,000,000.00` THB is valid and the request is submitted.
- **Actual:** Both submissions were blocked by the validation message `Enter an amount of at most 1,000,000.00 THB.` No request was created for either maximum-amount attempt.
- **Evidence:** [E-UAT-03-a0b6afa-maximum-rejected.png](evidence/E-UAT-03-a0b6afa-maximum-rejected.png) shows the entered maximum amount, validation message, and Build `a0b6afa`. Worawut supplied the same PNG again on 2026-11-26; it is already saved under this evidence ID. The request title in the screenshot dates it to the 2026-11-25 run.

![UAT-03 on Build a0b6afa: the 1,000,000.00 THB boundary is rejected](evidence/E-UAT-03-a0b6afa-maximum-rejected.png)

### UAT-03 — Controlled-build retest (2026-11-26)

- **Tester / time:** Codex at Worawut's request; 2026-11-26 approximately 00:46 Asia/Bangkok (the accepted request detail shows 00:46).
- **Build / URL:** `a0b6afa` — [controlled defect build](https://lab6uat---approval-flow-rdaxzekvca-as.a.run.app/). The page footer showed `Build a0b6afa`.
- **Account / role:** Ploy Srisawat, Requester.
- **Inputs and observed results:** Blank, `abc`, `12.345`, `0`, and `1000000.01` each showed the corresponding validation message described in UAT-03. `0.01` was accepted as `REQ-000054` (`UAT-03 Worawut 2026-11-26 06`, assigned to Mint). The inclusive maximum `1000000.00` was entered as `UAT-03 Worawut 2026-11-26 07`, assigned to Mint; the form instead showed `Enter an amount of at most 1,000,000.00 THB.` The My Requests list showed the new minimum request and no row for the title used in the rejected maximum attempt. Older maximum-boundary requests from other runs remain in the shared database.
- **Expected:** The minimum `0.01` and inclusive maximum `1,000,000.00` are accepted; invalid inputs are rejected with their validation messages.
- **Actual / result:** Invalid inputs matched expectation and the minimum was accepted. The inclusive maximum was rejected, so UAT-03 is **FAIL** on Build `a0b6afa`.
- **Evidence:** New retest screenshots are pending manual capture: `E-UAT-03-a0b6afa-RETEST-01-minimum-accepted.png` and `E-UAT-03-a0b6afa-RETEST-02-maximum-rejected.png`. The existing [E-UAT-03-a0b6afa-maximum-rejected.png](evidence/E-UAT-03-a0b6afa-maximum-rejected.png) belongs to the earlier 2026-11-25 run and is not evidence of this retest. CUA displayed the current page image but could not save a PNG file into the evidence directory.

## Final summary

- **Initial run on Build 21b7135:** Worawut's previously recorded result was 12/12 PASS.
- **Controlled build a0b6afa:** UAT-01, UAT-02, and UAT-04–UAT-11 passed in the 2026-11-26 retest. UAT-03 was not rerun at the user's request; its previously recorded controlled-build result is FAIL because the inclusive THB 1,000,000.00 boundary was rejected.
- **UAT-12:** PASS. The 10-minute lockout is within the 15-minute limit; the correct-password attempt remained locked, and Ploy could sign in during the lock. The exact number of failed attempts was not recorded because the browser-control tool timed out; the teammate confirmed the observed behavior is correct.
- **Overall:** The current record does not establish a full pass on Build a0b6afa: UAT-03 remains a recorded failure, and UAT-03 was not included in this latest retest. UAT-12 passed based on the confirmed 10-minute lockout behavior. No application source code or diff was inspected.
