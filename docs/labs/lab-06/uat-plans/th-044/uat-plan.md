# Lab 6: Sprint 1 user acceptance test (UAT) plan

> Source: partner-provided `lab06-uat-cases.docx`, version 0.3 dated 2026-11-23. This Markdown copy preserves the supplied handoff, UAT-01–UAT-12 steps, expected results, coverage map, and execution forms. Section 4.5 records TH-044's own pre-handoff dry run; it is not TH-019's independent UAT execution report.

> The expected behavior refers to the [TH-044 Sprint 1 contract](https://github.com/WirachatTH/cpe334-th044-p5-approval-flow/tree/v1.0.0-sprint1/docs/sprints/sprint-1). The shared test password is provided separately and is intentionally absent from this repository.

## Version history

| **Version** | **Date** | **Author** | **Change** | **Reason** |
|----|----|----|----|----|
| 0.1 | 2026-11-22 | Menelaus122 | First draft of the handoff and cases UAT-01 to UAT-12 | Lab 6 Part A |
| 0.2 | 2026-11-23 | Menelaus122 | Added a Purpose line to every case and the dry-run record (4.5) | Handout section 3.1 asks each case for a purpose; wrong expected text would cause false defects |
| 0.3 | 2026-11-23 | Menelaus122 | UAT-12 step 1: the message reads "1 minute" when N is 1, and "15 minutes" right after the sixth attempt. Section 4.5 filled in for the part of the dry run that needs no password | Dry run on the deployed release: the client builds this text from the Retry-After header (client/src/screens/Login.tsx) and the first draft did not mention the singular form |

## 1. Handoff

| **Item** | **Value** |
|----|----|
| Product | Approval Flow (TH-044_P5, Theme 5: Workflow & Approval System) |
| Scope accepted for test | **Sprint 1 only**: F-01 Authentication, F-02 Role-based access control, F-03 Submit and view own requests, F-04 Review decision and history, F-05 Seed and configuration (FR-01 to FR-12, BR-01 to BR-15). Return/resubmit, second approval, filters, summaries and hardening (F-06 to F-10) are **not** part of this acceptance |
| Sprint 1 baseline | Tag v1.0.0-sprint1, commit 67d5cfd |
| Release under test | Tag v1.1.0-lab5, commit 21b7135, Cloud Run revision approval-flow-00004-rq6. The Login page and every signed-in screen show Build 21b7135 |
| Difference from the baseline | Only the build footer in the client. server/src and server/prisma are identical between the two tags (checked with git diff) |
| URL | https://approval-flow-rdaxzekvca-as.a.run.app |
| Browser | A current Chrome, Edge, Firefox or Safari (assumption A-05) |
| Deployment freeze | We will not change the deployed revision while you test. If a fix is needed we tell you the new build number first, and the acceptance names the exact build you tested |

### 1.1 Accounts (the shared password is given privately; it is never in this document)

| **Label** | **Name**          | **Email**                       | **Role**  |
|-----------|-------------------|---------------------------------|-----------|
| REQ-A     | Ploy Srisawat     | ploy.requester@example.com      | REQUESTER |
| REQ-B     | Nattapong Kaewdee | nattapong.requester@example.com | REQUESTER |
| REV-A     | Mint Chaiyaporn   | mint.reviewer@example.com       | REVIEWER  |
| REV-B     | Korn Thanakit     | korn.reviewer@example.com       | REVIEWER  |

All data is synthetic (A-06).

### 1.2 Data setup, sequence and cleanup

- Every case creates its own requests, so the cases are **independent**,
  except that **UAT-12 must run last** (it deliberately locks one
  sign-in for up to 15 minutes).

- Start each request title with the case ID, your initials and the date,
  for example UAT-01 AB 2026-11-24, so that you can find your request
  among others in a list.

- There is no reset or cleanup step. Decided requests and their history
  cannot be deleted by design (BR-13), so test data stays in the
  database. The Review Inbox may list requests left by earlier testers:
  use the title to find yours.

- To read a JSON answer of the API (cases UAT-06 and UAT-07), signed in,
  paste the address into the same browser's address bar. The browser
  sends your session cookie, so no tool is needed.

### 1.3 Limitations we declare before testing

| **ID** | **Limitation** | **Why it is accepted** |
|----|----|----|
| KL-1 | The sign-in throttle counts in the memory of one server instance (decision D-10, question Q-08). If the service runs more than one instance, the 6th wrong attempt may not be refused | Revisited in F-10 (Sprint 3). See the note in UAT-12 |
| KL-2 | A request cannot be edited or deleted after submission | Specified: BR-15. Editing arrives with F-06 in Sprint 2 |

## 2. Cases

Conventions: **Expected** states what a tester sees; wording in
quotation marks is the exact text on screen. Time limits: no case needs
more than about 10 minutes.

### UAT-01 Normal journey: submit, approve, see the result

- **Purpose:** Show that a requester can submit a request, the assigned
  reviewer can approve it, and the requester then sees the outcome and
  the history.

- **Category:** normal domain journey

- **Requirements / AC:** FR-01, FR-04, FR-05, FR-06, FR-07, FR-08;
  AC-F01-14, AC-F03-15, AC-F03-20, AC-F04-13, AC-F04-18, AC-F04-20

- **Roles:** REQ-A, then REV-A, then REQ-A

- **Preconditions:** none

- **Inputs:** title UAT-01 \<initials\> \<date\>; description Two
  monitors for the lab; amount 1250.50; reviewer Mint Chaiyaporn;
  approval reason Within budget

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | Sign in as REQ-A | Lands on **My Requests**. The header shows "Ploy Srisawat" and the role. The menu shows My Requests and New Request, and no Review Inbox |
| 2 | Open **New Request**, enter the inputs, choose Mint, press **Submit request** | The detail page opens with "Request REQ-nnnnnn submitted." Status **Submitted**, reviewer Mint, and a history line "Submitted by …". Write down the request number |
| 3 | Open **My Requests** | The new request is at the top with amount 1,250.50, a status badge with the text "Submitted", reviewer Mint and the date |
| 4 | Log out. Sign in as REV-A | Lands on **Review Inbox**. The menu shows all three entries. The request is listed with number, title, requester Ploy, amount and date |
| 5 | Open the request. Type Within budget and press **Approve** | Banner "Request approved." The badge reads **Approved**. A Decision section shows decider Mint and the reason. A second history line appears. The decision panel disappears |
| 6 | Open **Review Inbox** again and reload the page | The request is no longer listed |
| 7 | Log out. Sign in as REQ-A. Open the request from **My Requests** | Badge **Approved**, decider Mint, reason Within budget, history in order: Submitted, then Approved. The same after a page reload |

### UAT-02 Rejection with a recorded reason

- **Purpose:** Show that a reviewer can reject a request with a reason,
  and that the requester sees that reason.

- **Category:** normal domain journey (second outcome)

- **Requirements / AC:** FR-09, BR-12, BR-13; AC-F04-05, AC-F04-13

- **Roles:** REQ-A, REV-A, REQ-A

- **Inputs:** title UAT-02 \<initials\> \<date\>, description Standing
  desk, amount 8000, reviewer Mint; rejection reason Please get a second
  quotation.

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | As REQ-A submit the request | "Request REQ-… submitted." Status Submitted |
| 2 | As REV-A open it, type the reason, press **Reject** | Banner "Request rejected." Badge **Rejected**. Decider Mint and the reason are shown. The panel disappears |
| 3 | As REQ-A open My Requests and the detail | Status **Rejected**, the reason Please get a second quotation., history Submitted then Rejected |

### UAT-03 Business rule: amount boundaries

- **Purpose:** Show that the amount rule (more than 0, at most
  1,000,000.00, two decimals at most) holds at both ends, and that a
  refused amount creates no request.

- **Category:** business rule / boundary

- **Requirements / AC:** BR-04; AC-F03-05, AC-F03-16

- **Role:** REQ-A. **Preconditions:** none

- **Inputs:** title UAT-03 \<initials\> \<date\> \<n\>, description
  boundary, reviewer Mint; try each amount in turn

| **Amount typed** | **Expected**                                         |
|------------------|------------------------------------------------------|
| (empty)          | "Enter an amount." beneath the field                 |
| abc              | "Enter the amount as a number, for example 1250.50." |
| 12.345           | "Enter the amount as a number, for example 1250.50." |
| 0                | "Enter an amount greater than 0."                    |
| 1000000.01       | "Enter an amount of at most 1,000,000.00 THB."       |
| 0.01             | Accepted: "Request REQ-… submitted."                 |
| 1000000.00       | Accepted: "Request REQ-… submitted."                 |

After each refusal nothing is sent and the focus moves to the field.
After all attempts reload **My Requests**: only the two accepted
requests exist (amounts 0.01 and 1,000,000.00).

### UAT-04 Business rule: a rejection needs a reason

- **Purpose:** Show that a rejection cannot be recorded without a
  reason, while an approval can.

- **Category:** business rule / boundary

- **Requirements / AC:** BR-12; AC-F04-06, AC-F04-17

- **Roles:** REQ-A, REV-A. **Inputs:** a request UAT-04 \<initials\>
  \<date\> to Mint

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | As REV-A open the request. Leave the reason empty and press **Reject** | "Enter a reason to reject this request." beneath the field, the focus is on it, nothing is sent |
| 2 | Type only spaces and press **Reject** | The same message |
| 3 | Reload the Review Inbox | The request is still listed and still undecided |
| 4 | Leave the reason empty and press **Approve** | Allowed: "Request approved." (an approval reason is optional) |

### UAT-05 Business rule: text limits and special characters

- **Purpose:** Show that the text limits are enforced and that special
  characters are displayed as text and never executed.

- **Category:** business rule / boundary

- **Requirements / AC:** BR-05; AC-F03-06, AC-F03-21

- **Role:** REQ-A

| **Input** | **Expected** |
|----|----|
| Empty title / empty description | "Enter a title." / "Enter a description." |
| A title of 121 characters (for example the letter A repeated 121 times) | "Title must be 120 characters or fewer." |
| A title of exactly 120 characters, description limit, amount 10, reviewer Mint | Accepted |
| Title \<script\>alert(1)\</script\>, description \<img src=x onerror=alert(1)\>, amount 10, reviewer Mint | Accepted. In My Requests and the detail both strings appear **as literal text**. No pop-up appears |

### UAT-06 Forbidden role: a requester cannot use reviewer functions

- **Purpose:** Show that a requester cannot reach reviewer functions
  through the menu, the page address or the API, and that a visitor who
  is signed out sees no data.

- **Category:** forbidden role (backend and UI)

- **Requirements / AC:** BR-01, BR-09, FR-10; AC-F02-01, AC-F02-03,
  AC-F02-11, AC-F02-12

- **Role:** REQ-A, then no session. **Preconditions:** none

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | Sign in as REQ-A. Look at the menu | No Review Inbox entry |
| 2 | Open \<URL\>/reviews | "This page is not available to you." No inbox is shown |
| 3 | In the same browser open \<URL\>/api/reviews/inbox | JSON with FORBIDDEN (status 403). No request data appears |
| 4 | Log out. Open \<URL\>/requests | The Login page is shown, with no request data |
| 5 | Open \<URL\>/api/reviews/inbox and \<URL\>/api/requests/mine | JSON with UNAUTHENTICATED (status 401) for both |

### UAT-07 Forbidden ownership: other users cannot see a request

- **Purpose:** Show that a user who is neither the requester nor the
  assigned reviewer cannot read a request, and that the refusal
  discloses nothing.

- **Category:** forbidden ownership (backend and UI)

- **Requirements / AC:** BR-08, BR-09, NFR-02; AC-F03-11, AC-F03-13,
  AC-F04-09

- **Roles:** REQ-A, REQ-B, REV-B. **Inputs:** a request UAT-07
  \<initials\> \<date\> from REQ-A to Mint; write down its page address
  /requests/\<id\>

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | As REQ-B open My Requests | The list does not contain REQ-A's request |
| 2 | As REQ-B open \<URL\>/requests/\<id\> | "This request is not available to you." No title, amount or history |
| 3 | As REQ-B open \<URL\>/api/requests/\<id\> | JSON NOT_FOUND (status 404), with no request data |
| 4 | Log out. As REV-B (not assigned) check the Review Inbox, then open \<URL\>/requests/\<id\> | Not listed in the inbox. "This request is not available to you." |
| 5 | As REV-B open \<URL\>/api/requests/\<id\> | JSON NOT_FOUND (status 404), the same body as step 3 |
| 6 | As REV-A (assigned) open the request | It opens normally, with the decision panel |

### UAT-08 Business rule: nobody approves their own request

- **Purpose:** Show that a reviewer cannot pick themselves as the
  reviewer and cannot decide their own request.

- **Category:** business rule (no self-approval)

- **Requirements / AC:** BR-06, BR-10; AC-F03-08, AC-F03-10, AC-F04-16,
  AC-F04-23

- **Roles:** REV-A, REV-B

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | As REV-A open **New Request** and open the Reviewer list | Mint is **not** in the list; Korn is |
| 2 | Submit UAT-08 \<initials\> \<date\> (amount 500) to Korn | "Request REQ-… submitted." |
| 3 | As REV-A open the Review Inbox | The request is **not** listed |
| 4 | As REV-A open the request detail (from My Requests) | It opens, status Submitted, and there is **no decision panel** |
| 5 | Log out. As REV-B open the Review Inbox | The request is listed, and its detail shows the decision panel |

### UAT-09 State, history and persistence

- **Purpose:** Show that a decision is stored permanently, that the
  history is complete and in order, and that a decided request cannot be
  changed.

- **Category:** state / history / persistence

- **Requirements / AC:** BR-11, BR-13, BR-15, FR-06; AC-F03-20,
  AC-F04-13, AC-F04-16, AC-F04-20

- **Roles:** REQ-A, REV-A. **Inputs:** a request UAT-09 \<initials\>
  \<date\> to Mint, then Mint rejects it with the reason Not in this
  quarter's budget.

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | As REQ-A open the detail of the decided request | History has exactly two lines, in order: Submitted (by Ploy), Rejected (by Mint, with the reason), each with a date and time |
| 2 | Reload the page, then log out and sign in again (or use a second browser) | The same status, reason and two history lines |
| 3 | As REV-A open the same request | No decision panel (it is no longer waiting). It is not in the Review Inbox |
| 4 | Look for any way to edit or delete the request as REQ-A | There is none (no edit or delete control) |

### UAT-10 State: a second decision on the same request is refused

- **Purpose:** Show that when two decisions collide only the first one
  counts, and that the second reviewer is told.

- **Category:** state / history (concurrency, BR-11, BR-14)

- **Requirements / AC:** AC-F04-11, AC-F04-19

- **Role:** REV-A, in two tabs. **Inputs:** a request UAT-10
  \<initials\> \<date\> to Mint

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | In tab 1 and tab 2 (both signed in as REV-A) open the request, so both show the decision panel | Both show the panel |
| 2 | In tab 1 press **Approve** | "Request approved." |
| 3 | In tab 2, without reloading, type a reason and press **Reject** | "This request has already been decided." The page reloads the request, shows **Approved**, and the panel is gone |
| 4 | As REQ-A open the request | Status Approved, history Submitted then Approved: **one** decision only, no Rejected line |

### UAT-11 Sign-in and sign-out

- **Purpose:** Show valid and invalid sign-in, the neutral error
  message, a session that survives a reload, and sign-out.

- **Category:** normal / negative (authentication)

- **Requirements / AC:** FR-01, FR-02, FR-03, NFR-06; AC-F01-02,
  AC-F01-03, AC-F01-04, AC-F01-14, AC-F01-15, AC-F01-17, AC-F01-18

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | Press **Sign in** with both fields empty | Both fields show a message beneath them, the focus is on Email, nothing is sent |
| 2 | Email PLOY.Requester@Example.COM (capitals, trailing space) and the correct password | Signed in as Ploy (the email is not case-sensitive) |
| 3 | Reload the page | Still signed in, on My Requests |
| 4 | Press **Log out**, then open \<URL\>/requests | The sign-in page is shown, with no request data |
| 5 | Sign in as ploy.requester@example.com with a wrong password | "Email or password is incorrect." The email stays in the field, the password is cleared |
| 6 | Sign in with an unknown email and any password | The **same** message as step 5, so a visitor cannot tell which emails exist |
| 7 | Sign in as REV-A | Lands on **Review Inbox** |

### UAT-12 Sign-in throttle (run last)

- **Purpose:** Show that repeated wrong passwords for one account are
  throttled without blocking other accounts.

- **Category:** negative (abuse protection)

- **Requirements / AC:** NFR-05; AC-F01-07, AC-F01-16

- **Role:** REQ-B (a locked sign-in lasts up to 15 minutes; do not use
  an account you still need)

| **\#** | **Action** | **Expected** |
|----|----|----|
| 1 | Sign in as REQ-B with a wrong password six times in a row | The first five show "Email or password is incorrect." The sixth shows "Too many sign-in attempts. Try again in N minutes." (N from 1 to 15; it reads "1 minute" when N is 1). Expect "15 minutes" right after the sixth attempt |
| 2 | Immediately sign in as REQ-B with the **correct** password | Still refused with the "Too many sign-in attempts" message |
| 3 | Sign in as REQ-A (a different account) | Allowed |

Note (KL-1): if the sixth attempt is not refused, repeat up to 12
attempts and record what you saw. Do not mark a FAIL for this alone: the
throttle counts per server instance and the service may have started a
second instance. Record the observation and the time instead.

## 3. Coverage of the four required categories

| **Category**                  | **Cases**                      |
|-------------------------------|--------------------------------|
| Normal domain journey         | UAT-01, UAT-02, UAT-11         |
| Business rule / boundary      | UAT-03, UAT-04, UAT-05, UAT-08 |
| Forbidden role / ownership    | UAT-06, UAT-07                 |
| State / history / persistence | UAT-09, UAT-10                 |

## 4. Templates for Parts B to D

### 4.1 Execution record (one row per case, for each team we test)

| **Case ID** | **Tester (team)** | **Date and time** | **Version tested (build)** | **Inputs used** | **Actual result** | **PASS / FAIL / BLOCKED** | **Evidence ID** |
|----|----|----|----|----|----|----|----|
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |

### 4.2 Defect report

| **Field**                                                   | **Value** |
|-------------------------------------------------------------|-----------|
| Issue ID / product team / reporter                          |           |
| Tested version                                              |           |
| Linked case and requirement or AC                           |           |
| Preconditions and data                                      |           |
| Steps to reproduce                                          |           |
| Expected result                                             |           |
| Actual result                                               |           |
| Severity (by user impact) and reason                        |           |
| Defect against specified behaviour, or new feature request? |           |
| Evidence                                                    |           |

### 4.3 Triage of received findings

| **Finding** | **Classification (accepted defect / duplicate / not-defect / enhancement)** | **Reason tied to the Sprint 1 contract** | **Severity** | **Owner** | **Fix status and release** | **Independent retest** |
|----|----|----|----|----|----|----|
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

### 4.4 Final decision (written by the UAT team only)

| **Field** | **Value** |
|----|----|
| Decision | Accepted / Accepted with documented minor limitations / Not accepted |
| Build tested |  |
| Tester names and team |  |
| Date |  |
| Conditions and limitations |  |

### 4.5 Dry-run record (our own team, before the handoff)

Run each case once ourselves on the release under test. A wrong expected
text would make the UAT team file a false defect against us.

Method of the first pass (2026-11-23, 20:43 to 20:50, UTC+7): curl
against the deployed URL by Menelaus122 with Claude Code, without any
password, plus a text search of the deployed client bundle
(/assets/index-IFq0NwYv.js, which contains 21b7135). The browser tool
failed three times (No group with id), so no screen was looked at. This
is **not** a manual run of the cases as the UAT team will do them.

| **Case ID** | **Tester** | **Date and time** | **Build** | **Matches the expected result?** | **Correction made to the case text (version)** |
|----|----|----|----|----|----|
| UAT-06 step 5 | Menelaus122 with Claude Code, curl | 2026-11-23 20:43 | 21b7135 (in the bundle; footer not viewed) | Yes. /api/reviews/inbox, /api/requests/mine and /api/auth/me each answer 401 with code UNAUTHENTICATED and no data | none |
| UAT-11 step 1 (API side) | same | 20:43 | same | Yes. 400 VALIDATION_ERROR, fields.email = "Enter your email address.", fields.password = "Enter your password." Whether the screen shows them beneath the fields and moves the focus is **not checked** | none |
| UAT-11 steps 5 and 6 (API side) | same | 20:43 | same | Yes. A known email with a wrong password and an unknown email give the identical body and 401: INVALID_CREDENTIALS, "Email or password is incorrect." The email kept and the password cleared on screen is **not checked** | none |
| UAT-12 step 1 (API side, on an unknown email so that no demo account is locked) | same | 20:43 to 20:44 | same | Yes. Six wrong attempts in a row: the first five 401, the sixth 429 with Retry-After: 898, and the attempts after it also 429. No sign of KL-1 (the same instance answered all of them). The client turns 898 s into "Try again in 15 minutes." | v0.3: "1 minute" singular and "15 minutes" right after the sixth attempt |
| UI texts used by all cases | same | 20:47 | 21b7135 | Partly. Each of 23 expected texts (all amount, title, description, reason, access, state, sign-in and throttle messages, the menu entries and the buttons) is present in the deployed bundle. That shows the wording exists, **not** that it appears at the right step | none |
| UAT-06 step 4 and UAT-11 step 4 (signed-out page address) | same | 20:48 | same | **Not confirmed.** /requests, /reviews and an unknown path answer 200 with the page shell; the move to the sign-in page happens in the browser | none |

**Not yet run:** UAT-01 to UAT-05, UAT-07 to UAT-10, UAT-06 steps 1 to
3, UAT-11 steps 2, 3 and 7, UAT-12 steps 2 and 3. Reason: they need a
signed-in session (the demo password is held privately and is not read
by the AI tool) and a working browser. A team member signed in must run
them once and add rows here before the handoff.

Side effect to know about: ploy.requester@example.com has one failed
sign-in recorded at 20:43 (it expires after 15 minutes), and the unknown
address used for the throttle check is locked until about 20:59. No demo
account is locked.
