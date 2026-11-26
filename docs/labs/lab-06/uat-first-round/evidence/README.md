# Lab 6 evidence

Evidence files are indexed here and referenced by Evidence ID from the related result, finding, or retest record.

## Naming convention

Use `E-<number>-<description>.<extension>` and reference each ID from the related result, finding, or retest row. Examples: `E-01-normal-flow.png`, `E-02-ownership-denied.png`, `E-03-red.txt`, `E-04-green.txt`.

## Evidence index

| Evidence ID | File | Related case / finding | Description |
|---|---|---|---|
| E-01 | [E-01-uat-01-approved-detail.png](E-01-uat-01-approved-detail.png) | UAT-01, steps 1–7 | REQ-000016 final detail on Build 21b7135: Approved by Korn, reason “Within budget,” and the Submitted → Approved history after reload. Captured from Chanon's browser; Worawut tested on a separate machine. |
| E-02 | [E-02-uat-02-rejected-detail.png](E-02-uat-02-rejected-detail.png) | UAT-02, steps 1-3 | REQ-000018 requester detail: Rejected by Korn with the recorded reason and Submitted → Rejected history. The supplied capture does not show the footer; Build 21b7135 was recorded from the live page. |
| E-03 | [E-03-uat-03-amount-boundaries.png](E-03-uat-03-amount-boundaries.png) | UAT-03, steps 1–7 | Screenshot supplied by Chanon after reload: My Requests shows REQ-000027 (0.01 THB) and REQ-000028 (1,000,000.00 THB), alongside the earlier UAT-01/02 requests; footer Build 21b7135 is visible. |
| E-04 | [E-04-uat-04-approved-detail.png](E-04-uat-04-approved-detail.png) | UAT-04, steps 1–4 | Screenshot supplied by Chanon: REQ-000031 is Approved and the Submitted → Approved history is visible. The capture does not show the footer; Build 21b7135 was recorded from the live page. |
| E-05 | [E-05-uat-05-markup-detail.png](E-05-uat-05-markup-detail.png) | UAT-05, text limits and markup handling | Screenshot supplied by Chanon: REQ-000033 detail displays the title and description markup literally, with no alert/dialog; Build 21b7135 is visible in the footer. |
| E-06 | Withheld — no public file | UAT-06, steps 1–5 | Signed-out `/api/requests/mine` response showed `UNAUTHENTICATED`; the 401 status, signed-in Review Inbox API 403, and signed-out API 401 checks were verified in Chrome DevTools. The screenshot was withheld because it included unrelated browser context. Build 21b7135 was recorded from the live page. |
| E-07 | [E-07-uat-07-authorized-reviewer.png](E-07-uat-07-authorized-reviewer.png) | UAT-07, step 6 | Mint Chaiyaporn's authorized view of REQ-000025 shows the request details, Decision panel, and Build 21b7135. No decision was submitted. |
| E-08 | [E-08-uat-08-no-self-approval.png](E-08-uat-08-no-self-approval.png) | UAT-08, steps 1–5 | Korn Thanakit's reviewer view of Mint Chaiyaporn's REQ-000034 shows Submitted status, the Decision panel, history, and Build 21b7135. Korn did not submit a decision. |
| E-09 | [E-09-uat-09-rejected-history.jpg](E-09-uat-09-rejected-history.jpg) | UAT-09, steps 1–4 | Ploy Srisawat's requester detail for REQ-000040 after reload/re-login: Rejected, Mint's reason, exactly two ordered history entries, and Build 21b7135. The related Review Inbox check confirmed the request was no longer listed and had no decision controls. |
| E-10 | [E-10-uat-10-stale-decision-rejected.jpg](E-10-uat-10-stale-decision-rejected.jpg) | UAT-10, steps 2–4 | Mint's stale second tab shows `This request has already been decided.`, final Approved status, only Submitted → Approved history, and Build 21b7135. |
| E-11a | [E-11-uat-11-empty-login-validation.jpg](E-11-uat-11-empty-login-validation.jpg) | UAT-11, step 1 | Empty sign-in submission displays both required-field messages with Email focused. |
| E-11b | [E-11-uat-11-reviewer-landing.jpg](E-11-uat-11-reviewer-landing.jpg) | UAT-11, step 7 | Mint's successful sign-in lands on Review Inbox; Build 21b7135 is visible. |
| E-12a | [E-12-uat-12-lock-after-six.jpg](E-12-uat-12-lock-after-six.jpg) | UAT-12, step 1 | After six wrong REQ-B passwords, the page shows the lock message with 14 minutes remaining. |
| E-12b | [E-12-uat-12-correct-password-still-locked.jpg](E-12-uat-12-correct-password-still-locked.jpg) | UAT-12, step 2 | A correct REQ-B password is still refused; the page shows 13 minutes remaining. |
| E-12c | [E-12-uat-12-other-account-still-works.jpg](E-12-uat-12-other-account-still-works.jpg) | UAT-12, step 3 | Ploy signs in successfully while Nattapong's account is throttled; Build 21b7135 is visible. |
| X-01 | [X-01-exploratory-requester-long-title-overflow.jpg](X-01-exploratory-requester-long-title-overflow.jpg) | Exploratory, requester | My Requests at the leftmost scroll position shows horizontal overflow caused by a valid 120-character unbroken title. |
| X-02 | [X-02-exploratory-reviewer-horizontal-scroll.jpg](X-02-exploratory-reviewer-horizontal-scroll.jpg) | Exploratory, reviewer | Review Inbox shows the same overflow; the right-side columns can be reached only by horizontal scrolling. |
| X-03a | [X-03a-exploratory-reviewer-after-requester-logout.png](X-03a-exploratory-reviewer-after-requester-logout.png) | X-03, reviewer view | The previously rendered REQ-000041 reviewer detail remains visible in the other tab after logout from My Requests; Build 21b7135 is visible. |
| X-03b | [X-03b-exploratory-requester-after-reviewer-logout.png](X-03b-exploratory-requester-after-reviewer-logout.png) | X-03, requester view | My Requests still displays Mint's list after logout from the reviewer tab; Build 21b7135 is visible. |
