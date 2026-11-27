# NFR-PERF-01 F-06 Benchmark Result

**Status: MEASURED — PASS.** The F-06 form-read benchmark ran on 2026-11-27. The required p95 target is below 300 ms; the measured p95 was 70.154 ms.

- **Command:** `npm run bench:read --prefix server`
- **Route:** `GET /api/surveys/:id/form`
- **Workload:** 50 sequential authenticated reads of one published form with one question of each F-06 type: MULTI_CHOICE, LONG_TEXT, YES_NO, LIKERT, RATING, INTEGER, and DATE.
- **Results:** p50 16.502 ms; p95 70.154 ms; p99 2,139.614 ms; p95 target 300 ms; benchmark passed.
- **Environment:** Node v24.14.1; PostgreSQL 16.15 in a disposable test container; Windows 10 x64; Intel Core i5-8250U; database `surveyhub_test`.
- **Isolation:** The test container used host port 51538 and was removed after verification. The existing Compose database and its volume were left unchanged.
- **Raw result:** [`nfr-perf-01.json`](nfr-perf-01.json).
