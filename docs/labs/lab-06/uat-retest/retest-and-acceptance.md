# Lab 6 — Retest and acceptance

| Finding / issue | Fix PR | CI result / run link | RED / GREEN evidence | Deployed revision / source commit | Retest case | Tester / date | Retest result | UAT decision |
|---|---|---|---|---|---|---|---|---|
| UAT-03 — inclusive maximum amount rejected on controlled build | Not provided in the report | Not provided in the report | RED: [E-UAT-03-a0b6afa-maximum-rejected.png](../uat-exercise/evidence/E-UAT-03-a0b6afa-maximum-rejected.png) (earlier run). GREEN: E-RETEST-03-01–07, linked in the [retest results](uat-results.md). | `approval-flow-00008-wtx` / `fe232c0893a11116413682222ddc64ef7dbd0a34`, supplied by TH-044 and not independently verified; app displayed `Build fe232c0`. | UAT-03 amount boundaries | Worawut (TH-019), 2026-11-26 | PASS | Accepted for UAT-03 retest only; not suite-wide acceptance. |

## Acceptance decision

| Decision | Tester(s) | Date | Evidence / notes |
|---|---|---|---|
| Accepted — UAT-03 retest only | Worawut (TH-019) | 2026-11-26 | The inclusive maximum `1,000,000.00` THB submitted successfully as `REQ-000067`; the app displayed `Build fe232c0`. See [UAT-03 retest results](uat-results.md) and evidence E-RETEST-03-01–07. Revision and commit were supplied by TH-044 and were not independently verified. This does not record acceptance of the remaining UAT cases. |
