# Lab 6 UAT plans and records

This folder contains both teams' test plans and the execution records for each UAT round. A plan states what to test and the expected result; a round report records what was actually observed.

## Test plans

| Plan | Product under test | UAT team | Direction |
|---|---|---|---|
| [TH-019 UAT plan](uat-plans/th-019/uat-plan.md) | SurveyHub (TH-019) | TH-044 | TH-044 tests SurveyHub |
| [TH-044 UAT plan](uat-plans/th-044/uat-plan.md) | Approval Flow (TH-044) | TH-019 | TH-019 tests Approval Flow |

## Execution rounds

| Round | Contents | Report |
|---|---|---|
| [First round](uat-first-round/) | TH-019's initial execution of TH-044's UAT cases, plus its evidence | [uat-results.md](uat-first-round/uat-results.md) |
| [UAT exercise](uat-exercise/) | Controlled-build exercise results and evidence; includes observed findings | [uat-results.md](uat-exercise/uat-results.md) |
| [UAT retest](uat-retest/) | Retest results and evidence after the corrective build | [uat-results.md](uat-retest/uat-results.md) |

Each round folder has an `evidence/` subfolder. The exercise round also contains [`findings.md`](uat-exercise/findings.md); the retest round contains [`retest-and-acceptance.md`](uat-retest/retest-and-acceptance.md).

Test accounts are synthetic where stated. Passwords, tokens, session cookies, student ID numbers, and saved-password prompts do not belong in the public repository. The UAT-06 screenshot was withheld because it included unrelated browser tabs and a debugging banner; the observed API response and HTTP status remain recorded in the report. No public image is provided for that check.
