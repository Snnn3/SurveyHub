# Lab 6 — UAT exercise evidence

## Evidence audit

This directory contains 38 PNG files. Thirty-seven are screenshots captured for the 2026-11-26 controlled-build retest on Build a0b6afa. The remaining image, E-UAT-03-a0b6afa-maximum-rejected.png, is the previously supplied UAT-03 screenshot from the 2026-11-25 run; it is retained as prior evidence and was not recaptured in this run.

Evidence screenshots are cropped to the relevant application view. API screenshots retain the Network panel to show the HTTP status; UAT-09-03 is cropped to the application panel because its Network panel is unrelated.

The UAT-12 lockout screenshot shows a 10-minute wait and the Build a0b6afa footer. Ploy's My Requests screenshot shows the separate account could sign in during that lock. The teammate confirmed that a 10-minute lockout is correct and within the 15-minute limit, so UAT-12 is marked PASS. The browser-control tool timed out during the repeated wrong-password sequence, so the exact attempt number that triggered the lockout is not recorded.

## Selected image references

| Case | Selected image(s) | What the image shows and its limit |
| --- | --- | --- |
| UAT-01 | [E-UAT-01-01](E-UAT-01-01-Codex-submitted.png), [E-UAT-01-02](E-UAT-01-02-Codex-approved.png) | Ploy's request submission and Mint's approval for REQ-000055. |
| UAT-02 | [E-UAT-02-01](E-UAT-02-01-Codex-rejected.png) | Mint's rejection for REQ-000056. |
| UAT-03 | [E-UAT-03](E-UAT-03-a0b6afa-maximum-rejected.png) | Screenshot from the 2026-11-25 run shows the inclusive maximum rejected. The 2026-11-26 controlled-build retest also recorded FAIL; its new screenshots were not saved in this folder. |
| UAT-04 | [E-UAT-04-01](E-UAT-04-01-Codex-empty-reason-validation.png), [E-UAT-04-02](E-UAT-04-02-Codex-whitespace-validation.png), [E-UAT-04-03](E-UAT-04-03-Codex-blank-reason-approved.png) | Blank and whitespace-only rejection reason validation, then approval with no rejection reason for REQ-000057. |
| UAT-05 | [E-UAT-05-01](E-UAT-05-01-Codex-required-fields.png), [E-UAT-05-02](E-UAT-05-02-Codex-title-over-limit.png), [E-UAT-05-03](E-UAT-05-03-Codex-title-at-limit.png), [E-UAT-05-04](E-UAT-05-04-Codex-literal-html.png) | Required fields, title length boundary, and literal HTML-like text shown as text. |
| UAT-06 | [E-UAT-06-01](E-UAT-06-01-Codex-requester-menu.png), [E-UAT-06-02](E-UAT-06-02-Codex-reviews-denied.png), [E-UAT-06-03](E-UAT-06-03-Codex-forbidden-403.png), [E-UAT-06-04](E-UAT-06-04-Codex-signed-out-inbox-401.png), [E-UAT-06-05](E-UAT-06-05-Codex-signed-out-mine-401.png) | Requester menu and reviewer-page denial, signed-in 403, and signed-out 401 responses. |
| UAT-07 | [E-UAT-07-01](E-UAT-07-01-Codex-REQB-unavailable-404.png), [E-UAT-07-02](E-UAT-07-02-Codex-REQB-not-found-404.png), [E-UAT-07-03](E-UAT-07-03-Codex-REVB-unavailable-404.png), [E-UAT-07-04](E-UAT-07-04-Codex-REVB-not-found-404.png), [E-UAT-07-05](E-UAT-07-05-Codex-Mint-assigned-panel.png) | Request access denied to other requester/unassigned reviewer and decision panel for assigned reviewer. |
| UAT-08 | [E-UAT-08-01](E-UAT-08-01-Codex-reviewer-options.png), [E-UAT-08-02](E-UAT-08-02-Codex-Mint-request-detail.png), [E-UAT-08-03](E-UAT-08-03-Codex-Korn-inbox.png), [E-UAT-08-04](E-UAT-08-04-Codex-Korn-decision-panel.png) | Mint cannot select themself; Korn receives the request and can decide it. |
| UAT-09 | [E-UAT-09-01](E-UAT-09-01-Codex-Mint-inbox-after-rejection.png), [E-UAT-09-02](E-UAT-09-02-Codex-Mint-rejected-history.png), [E-UAT-09-03](E-UAT-09-03-Codex-Ploy-history-reloaded.png) | REQ-000062 removed from Mint's inbox and persistent rejection visible in Ploy's reloaded history. |
| UAT-10 | [E-UAT-10-01](E-UAT-10-01-Codex-stale-reject-blocked.png), [E-UAT-10-02](E-UAT-10-02-Codex-approved-after-reload.png), [E-UAT-10-03](E-UAT-10-03-Codex-Ploy-single-approval.png) | Stale second decision blocked; one approval remains after reload and in Ploy's view. |
| UAT-11 | [E-UAT-11-01](E-UAT-11-01-Codex-empty-form-errors.png), [E-UAT-11-02](E-UAT-11-02-Codex-requests-redirect-login.png), [E-UAT-11-03](E-UAT-11-03-Codex-known-account-wrong-password.png), [E-UAT-11-04](E-UAT-11-04-Codex-unknown-email-same-message.png), [E-UAT-11-05](E-UAT-11-05-Codex-Mint-lands-inbox.png) | Empty form validation, signed-out redirect, same generic error for known/unknown account, and reviewer landing page. |
| UAT-12 | [E-UAT-12-02](E-UAT-12-02-Codex-REQB-locked-10min.png), [E-UAT-12-03](E-UAT-12-03-Codex-Ploy-access-during-lockout.png) | REQ-B remained locked with a 10-minute message after the correct-password attempt; Ploy accessed My Requests during that lock. Exact failed-attempt count is unverified. |

Keep the existing evidence IDs when linking these images from the matching case in the results report. No PDF evidence is used.
