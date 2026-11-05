# Part E (continued): Shared System Contracts and Test Specifications

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)\
**Course:** CPE 334 Software Engineering, Semester 1/2026\
**Deliverable:** Project Deliverable 1 — Part E (20 points; shared by GitHub Issues [#1](https://github.com/Snnn3/SurveyHub/issues/1) and [#7](https://github.com/Snnn3/SurveyHub/issues/7))\
**Document status:** Contract baseline v3, aligned with team decisions on 5 November 2026\
**Related documents:** [SRS](../../srs.md), [feature inventory](../../features.md), [traceability](../../traceability.md), [system design](../../system-sds.md), [verification plan](../../verification.md)

## 6. System Endpoint Contract: GET `/api/health`

This endpoint is one of the 16 endpoints in the Part C §4.4 system surface. It is delivered by the
scaffold (Issue #2) rather than by a Sprint 1 feature, so it has no FR or feature AC of its own. It
proves that the API process is running and can reach the database.

### 6.1 API specification

#### GET `/api/health` (public)

No authentication. No request body.

Success `200`:

```json
{
  "success": true,
  "data": { "status": "ok", "database": "up" }
}
```

Failure `503` when the database check fails:

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Database connection failed."
  }
}
```

Rules:

- The handler runs a trivial `SELECT 1`; it returns no table names, row data or credentials.
- The response exposes no version, host, environment variable or stack trace.
- The endpoint is public so a load balancer or container probe can call it.
- The health check is verified by the Issue #2 acceptance criteria, not by the 40 feature tests below.
  Its latency is not used as evidence for NFR-PERF-01.

---

## 7. Supporting Unit Tests

These tests cover pure functions so important logic is verified without HTTP or database setup. They
supplement, not replace, the integration tests.

File: `server/tests/unit/rules.test.ts`

| Test ID | Target | Input | Expected |
|---|---|---|---|
| **STS-U-01** | Survey structure validator | Draft with zero questions | Invalid with `NO_QUESTIONS` |
| **STS-U-02** | Survey structure validator | Single-choice with one option | Invalid with `TOO_FEW_OPTIONS` |
| **STS-U-03** | Answer validator | Missing required question | Invalid with the missing id |
| **STS-U-04** | Answer validator | 2,001-character text; empty required text | Invalid in both cases |
| **STS-U-05** | Percentage calculator | 0 answered; 1/3 answered; 2/3 answered | `0`; `33.33`; `66.67` |

---

## 8. Security Matrix Tests

File: `server/tests/security-matrix.test.ts`

Acceptance criteria:

| AC | Observable outcome |
|---|---|
| **AC-SEC-01** | Every protected endpoint rejects a missing, malformed or expired token with `401` and returns no private data. |
| **AC-SEC-02** | Every forbidden role or ownership operation returns `403` with the correct code and leaves the database unchanged. |

| Test ID | Target | Method | Expected |
|---|---|---|---|
| **STS-SEC-01** | Every protected route (all 16 except login and health) | Call with no token, malformed token and expired token | `401` with `TOKEN_REQUIRED` or `INVALID_TOKEN`; no private data |
| **STS-SEC-02** | Role and ownership matrix from Part C §5.3 | Call each operation with the wrong role and a non-owner | `403` with the correct code; database unchanged |

The role matrix must include endpoints added after Sprint 1; the test enumerates the route table rather
than a hand-written list that can drift.

---

## 9. End-to-End Tests

File: `e2e/sprint1-survey-flow.spec.ts`

| Test ID | Journey | Expected |
|---|---|---|
| **STS-E2E-01** | Owner logs in, creates a survey, publishes it; respondent logs in, submits; owner views the summary | Survey published, response persisted, summary shows 1 response and 100% for the chosen option |
| **STS-E2E-02** | Respondent tries to submit twice, then opens another respondent's receipt URL, then logs out and reuses the old token | `409`, `403`, and `401 TOKEN_REVOKED` respectively |

E2E tests run against a clean seeded database and a production-like build.

---

## 10. Test Count Summary

| Suite | File | Planned tests |
|---|---|---:|
| F-01 | `server/tests/auth.test.ts` | 6 |
| F-02 | `server/tests/survey-lifecycle.test.ts` | 11 |
| F-03 | `server/tests/response-submission.test.ts` | 10 |
| F-04 | `server/tests/survey-summary.test.ts` | 4 |
| Security | `server/tests/security-matrix.test.ts` | 2 |
| **Integration subtotal** | | **33** |
| Unit | `server/tests/unit/rules.test.ts` | 5 |
| E2E | `e2e/sprint1-survey-flow.spec.ts` | 2 |
| **Total planned automated tests** | | **40** |

This total is a plan. Part F records the actual count after execution, including any added, failed or
skipped tests.

---

## 11. TDD Protocol for BR-01

BR-01 is the required TDD demonstration because it is a rule with a real concurrency risk.

### Red stage

1. Confirm the frozen contract in `docs/sprints/sprint-1/f-03.md` and Issue [#1](https://github.com/Snnn3/SurveyHub/issues/1). On the Issue [#5](https://github.com/Snnn3/SurveyHub/issues/5) branch, commit the failing test before implementation.
2. Test: submit once (expect `201`), submit again (expect `409`), and submit two concurrent requests
   (expect one `201` and one `409`).
3. Run `npm test -- response-submission.test.ts`.
4. Record the real failure output. The expected failure is `409` received but `201` returned.
5. Commit message: `test(rules): add failing BR-01 duplicate submission test (red)`.

### Green stage

1. Add the `ResponseClaim` check, unique constraint and `P2002` mapping.
2. Use a transaction so no partial response is stored.
3. Re-run the test until it passes.
4. Record the real passing output.
5. Commit message: `feat(rules): enforce BR-01 duplicate submission guard (green)`.

### Refactor

- Extract the claim creation and error mapping into the response service.
- Keep the test unchanged; it must still pass.

Part F must include the two commit SHAs and the actual terminal excerpts. If the red stage cannot be
reproduced, the team must say so rather than fabricate it.

---

## 12. Contract Version History

| Version | Date | Change | Status |
|---|---|---|---|
| v1 | 4 Nov 2026 | Original Thai draft; F-01..F-04 outlined; no edit/delete endpoints; single `selectedOptionId`; client-only logout; fabricated execution log | Superseded |
| v2 | 5 Nov 2026 | English rewrite; added draft detail/update/delete endpoints; `AnswerOption` and `numberValue`; `ResponseClaim`; `tokenVersion`; corrected BR IDs; defined 40-test plan; removed fabricated evidence | Superseded |
| v3 | 5 Nov 2026 | Aligned repository paths and issue links with the shared Kanban; included Docker Compose in Sprint 1; documented feature PRs to staging and release PRs to main | Current, pre-implementation |

The version history is kept so the change is visible. Contracts are not silently rewritten after
implementation.

---

## 13. Contract Review Checklist

- [ ] Both students read the contract before implementation.
- [ ] Every AC has at least one planned test.
- [ ] Every planned test maps to an AC or an NFR.
- [ ] Every endpoint in this document appears in Part C and vice versa.
- [ ] Every negative case has an expected status and error code.
- [ ] No test is marked passing in the contract.
- [ ] The contract commit exists before the first implementation commit.
