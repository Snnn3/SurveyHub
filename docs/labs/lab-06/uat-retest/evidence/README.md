# Lab 6 — Retest evidence

Screenshots in this folder were captured from the application during the 2026-11-26 UAT-03 retest using computer use. UAT-03 was the only known defect and is the only case included in this retest. The inline images and outcomes are in [uat-results.md](../uat-results.md).

| Evidence ID | File | Captured (Asia/Bangkok) | What it shows |
| --- | --- | --- | --- |
| E-RETEST-03-01 | [E-RETEST-03-01-blank-amount.jpg](E-RETEST-03-01-blank-amount.jpg) | 2026-11-26 21:00:34 | Blank amount and required-field validation. |
| E-RETEST-03-02 | [E-RETEST-03-02-nonnumeric-amount.jpg](E-RETEST-03-02-nonnumeric-amount.jpg) | 2026-11-26 21:00:50 | `abc` and numeric-format validation. |
| E-RETEST-03-03 | [E-RETEST-03-03-excess-decimal-places.jpg](E-RETEST-03-03-excess-decimal-places.jpg) | 2026-11-26 21:01:28 | `12.345` and numeric-format validation. |
| E-RETEST-03-04 | [E-RETEST-03-04-zero-amount.jpg](E-RETEST-03-04-zero-amount.jpg) | 2026-11-26 21:01:37 | `0` and greater-than-zero validation. |
| E-RETEST-03-05 | [E-RETEST-03-05-above-maximum.jpg](E-RETEST-03-05-above-maximum.jpg) | 2026-11-26 21:02:02 | `1,000,000.01` and maximum validation. |
| E-RETEST-03-06 | [E-RETEST-03-06-minimum-accepted.jpg](E-RETEST-03-06-minimum-accepted.jpg) | 2026-11-26 21:03:15 | `0.01` accepted as `REQ-000066`. |
| E-RETEST-03-07 | [E-RETEST-03-07-maximum-accepted.jpg](E-RETEST-03-07-maximum-accepted.jpg) | 2026-11-26 21:04:56 | `1,000,000.00` accepted as `REQ-000067`. |

## Excluded URL access attempt

[E-RETEST-00-provided-url-404.jpg](E-RETEST-00-provided-url-404.jpg) records the initial attempt using a mistyped host (the `x` and `z` were transposed). That URL returned an access error before the app test began. It is not a product defect or UAT result and is excluded from the retest results and final decision. It is retained only as a trace of that non-test attempt.
