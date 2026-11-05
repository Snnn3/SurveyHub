# Part B (continued): Requirements Traceability

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)\
**Course:** CPE 334 Software Engineering, Semester 1/2026\
**Deliverable:** Project Deliverable 1 — Part B (10 points across `features.md` and this document)\
**Document status:** Baseline v5, aligned with the reviewed traceability on 6 November 2026\
**Related documents:** [SRS](srs.md), [feature inventory](features.md), [system design](system-sds.md), [Sprint 1 contracts](sprints/sprint-1/README.md), [verification plan](verification.md)

> Status note: every row is a **plan** until actual test evidence for the assessed commit is recorded in Part F. No requirement is marked verified in advance.

## 2. Traceability Matrix

Status values: **PLANNED** (designed, not implemented), **IMPLEMENTED** (code exists, not verified),
**VERIFIED** (real test run recorded), **FAILED**, **SKIPPED**, **DEFERRED** (later sprint).

### 2.1 Functional requirements

| Requirement | Summary | Feature | Sprint | Acceptance criteria | Planned verification | Status |
|---|---|---|---|---|---|---|
| **FR-01** | Login, logout and token revocation | F-01 | 1 | AC-F01-01..05 | STS-F01-01..05 | PLANNED |
| **FR-02** | Current user and role, no password hash exposure | F-01 | 1 | AC-F01-03, AC-F01-06 | STS-F01-03, STS-F01-06 | PLANNED |
| **FR-03** | Manage survey drafts | F-02 | 1 | AC-F02-01..03, AC-F02-05 | STS-F02-01..03, STS-F02-05 | PLANNED |
| **FR-04** | Author and edit draft questions | F-02 | 1 | AC-F02-04, AC-F02-10 | STS-F02-04, STS-F02-10 | PLANNED |
| **FR-05** | Publish survey | F-02 | 1 | AC-F02-06, AC-F02-07 | STS-F02-06, STS-F02-07 | PLANNED |
| **FR-06** | Close survey | F-02 | 1 | AC-F02-08, AC-F02-11 | STS-F02-08, STS-F02-11 | PLANNED |
| **FR-07** | Browse published surveys and load a survey form | F-03 | 1 | AC-F03-01, AC-F03-02 | STS-F03-01, STS-F03-02 | PLANNED |
| **FR-08** | Take and submit survey | F-03 | 1 | AC-F03-03..07, AC-F03-09 | STS-F03-03..07, STS-F03-09 | PLANNED |
| **FR-09** | Persisted confirmation and receipt retrieval | F-03 | 1 | AC-F03-03, AC-F03-10 | STS-F03-03, STS-F03-10 | PLANNED |
| **FR-10** | Aggregate summary (Sprint 1 formats) | F-04 | 1 | AC-F04-01..04 | STS-F04-01..04 | PLANNED |
| **FR-11** | Anonymous responses | F-05 | 2 | AC-S2-01, AC-PRIV-01 | STS-S2-01, STS-PRIV-01 | DEFERRED |
| **FR-12** | Expanded question types and type-aware summary | F-06, [Issue #9](https://github.com/Snnn3/SurveyHub/issues/9) | 2 | AC-F06-01..09 | Sprint 2 STS to be defined before implementation | DEFERRED |
| **FR-13** | CSV/JSON export | F-08 | 3 | AC-S3-01 | STS-S3-01 | DEFERRED |
| **FR-14** | Eligibility allowlist | F-07 | 2 | AC-S2-03 | STS-S2-03 | DEFERRED |
| **FR-15** | Scheduled close | F-07 | 2 | AC-S2-04 | STS-S2-04 | DEFERRED |
| **FR-16** | Browse individual responses | F-08 | 3 | AC-S3-02 | STS-S3-02 | DEFERRED |

### 2.2 Business rules

| Rule | Summary | Feature | Sprint | Acceptance criteria | Planned verification | Status |
|---|---|---|---|---|---|---|
| **BR-01** | One response per respondent per survey, including concurrency | F-03 | 1 | AC-F03-04 | STS-F03-04 (TDD) | PLANNED |
| **BR-02** | Only PUBLISHED (and not past `closesAt`) accepts responses | F-03, F-07 | 1, 2 | AC-F03-05, AC-S2-04 | STS-F03-05, STS-S2-04 | PLANNED |
| **BR-03** | Required/type/option/text validation | F-03 | 1 | AC-F03-06, AC-F03-07 | STS-F03-06, STS-F03-07 | PLANNED |
| **BR-04** | Survey ownership boundary | F-02, F-04 | 1 | AC-F02-09, AC-F04-03 | STS-F02-09, STS-F04-03 | PLANNED |
| **BR-05** | Cross-response privacy | F-03, F-04 | 1 | AC-F03-08, AC-F04-02 | STS-F03-08, STS-F04-02 | PLANNED |
| **BR-06** | Publish structure requirements | F-02 | 1 | AC-F02-07 | STS-F02-07 | PLANNED |
| **BR-07** | Immutable structure after publication | F-02 | 1 | AC-F02-10 | STS-F02-10 | PLANNED |
| **BR-08** | Role and eligibility guard for submission | F-03, F-07 | 1, 2 | AC-F03-09, AC-S2-03 | STS-F03-09, STS-S2-03 | PLANNED |
| **BR-09** | CLOSED is terminal; invalid transitions rejected | F-02 | 1 | AC-F02-11 | STS-F02-11 | PLANNED |
| **BR-10** | Anonymous identity/answer separation | F-05 | 2 | AC-S2-01, AC-PRIV-01 | STS-S2-01, STS-PRIV-01 | DEFERRED |
| **BR-11** | No respondent identity in aggregates or exports | F-04, F-08 | 1, 3 | AC-F04-01, AC-S3-02 | STS-F04-01, STS-S3-02 | PLANNED |

### 2.3 Non-functional requirements

| NFR | Target | Responsible feature | Sprint | Acceptance criterion | Verification | Status |
|---|---|---|---|---|---|---|
| **NFR-SEC-01** | Every protected endpoint rejects missing/invalid tokens with 401 and no data | F-01, cross-cutting | 1 | AC-SEC-01 | STS-SEC-01 (parameterized route matrix) | PLANNED |
| **NFR-SEC-02** | Every forbidden role/ownership operation returns 403 and leaves data unchanged | F-01..F-04 | 1 | AC-SEC-02 | STS-SEC-02 plus STS-F02-09, F03-08, F03-09, F04-02, F04-03 | PLANNED |
| **NFR-SEC-03** | bcrypt cost 10, no plaintext password, no hash in responses | F-01 | 1 | AC-F01-06 | STS-F01-06 | PLANNED |
| **NFR-SEC-04** | Logout revokes existing tokens | F-01 | 1 | AC-F01-05 | STS-F01-05 | PLANNED |
| **NFR-PERF-01** | p95 of `GET /api/surveys/:id/form` < 300 ms over 50 requests on the local development environment | F-03 | 1 | AC-PERF-01 | `server/scripts/benchmark-read.ts`; result JSON in Part F | PLANNED |
| **NFR-DATA-01** | Foreign keys and unique constraints exist; data survives API and database restart | F-02, F-03 | 1 | AC-DATA-01 | Migration inspection, STS-F03-03, documented restart check | PLANNED |
| **NFR-PRIV-01** | Anonymous responses have no identity link and no identity fields in output | F-05 | 2 | AC-PRIV-01 | STS-PRIV-01 database audit and response-shape assertions | DEFERRED |

Deferred rows use `AC-S2-*`, `STS-S2-*`, `AC-S3-*` and `STS-S3-*` as scheduling placeholders. They are
defined in the Sprint 2 and Sprint 3 contracts; they are not claimed as existing Sprint 1 IDs.

### 2.4 Cross-cutting test suites

These supplemental suites cover criteria across more than one feature. Sprint 2 criteria remain
deferred until their contracts and tests are defined.

| Test ID | Scope | Linked acceptance criteria | Status |
|---|---|---|---|
| **STS-U-01** | Reject a draft with no questions | AC-F02-07 | PLANNED |
| **STS-U-02** | Reject a single-choice question with one option | AC-F02-07 | PLANNED |
| **STS-U-03** | Report an omitted required answer | AC-F03-06 | PLANNED |
| **STS-U-04** | Reject blank required and over-limit short text | AC-F03-06, AC-F03-07 | PLANNED |
| **STS-U-05** | Calculate response percentages and rounding | AC-F04-01 | PLANNED |
| **STS-E2E-01** | Complete owner-to-respondent survey journey and inspect summary | AC-F02-02, AC-F02-06, AC-F03-03, AC-F04-01 | PLANNED |
| **STS-E2E-02** | Reject duplicate submission and cross-response access; verify token revocation | AC-F01-05, AC-F03-04, AC-F03-08 | PLANNED |

---

## 3. Coverage and Gap Analysis

### 3.1 Coverage summary

| Requirement group | Total | Mapped | Sprint 1 executable | Later sprint |
|---|---:|---:|---:|---:|
| Functional requirements | 16 | 16 | 10 | 6 |
| Business rules | 11 | 11 | 10 | 1 |
| Non-functional requirements | 7 | 7 | 6 | 1 |
| **Total** | **34** | **34** | **26** | **8** |

- No baseline requirement is unmapped.
- FR-11..FR-16, BR-10 and NFR-PRIV-01 have no Sprint 1 verification and are marked DEFERRED, not
  missing.
- BR-02 (scheduled close), BR-08 (allowlist) and BR-11 (raw export) have a Sprint 1 portion that is
  verified now and an extension that is deferred to a later sprint. Their Sprint 1 portions are
  included in the 26.
- Sprint 1 has executable verification planned for every one of its 26 requirements.
- The previous draft's uncovered items were FR-04 (no edit endpoint), BR-07 (no way to modify a
  survey), and the eligibility behaviour required by the theme's Sprint 1 example. All three are now
  explicitly covered.

### 3.2 Approved baseline changes

| Change | Affected requirements/features | Reason | Recorded in |
|---|---|---|---|
| Added owner list/detail/update and draft-delete endpoints | FR-03, FR-04, BR-07, F-02 | The previous baseline promised editing but lacked supporting lifecycle endpoints, so the draft flow and BR-07 could not be fully tested | Part A §4; Part C API table; Part E F-02 |
| Clarified draft lifecycle coverage in FR-03 and Part B | FR-03, F-02 | F-02 already specified list, detail and draft deletion, but the requirements and traceability matrix did not identify those behaviors | Part A §4; Part B §2.1 |
| Added `AnswerOption` and `numberValue` | FR-12, F-06 | One selected option per answer cannot represent multi-select; ratings need a numeric field | Part C §2; Part A ADR-05 |
| Expanded F-06 to the nine-type question catalog and fixed type-specific answer rules | FR-12, BR-03, BR-06, F-06 | The previous baseline covered only multi-choice and rating; the expanded product needs explicit answer shapes, bounds and Sprint 2 allocation | Part A §§3–5; Part B §§1.2–1.3; Part C §§2, 8; Part D; GitHub Issues [#1](https://github.com/Snnn3/SurveyHub/issues/1) and [#9](https://github.com/Snnn3/SurveyHub/issues/9) |
| Added `SurveyEligibility` | FR-14, BR-08, F-07 | Eligibility was missing from the baseline despite the theme's Sprint 1 example | Part A §4; Part C §2 |
| Added `ResponseClaim` | BR-01, BR-10, F-05 | A nullable `respondentId` does not enforce one response per person in anonymous mode | Part C §2.4 |
| Added `User.tokenVersion` | FR-01, NFR-SEC-04, F-01 | Logout must invalidate the token, not only clear browser state | Part A ADR-02; Part E F-01 |
| Replaced the performance claim with a defined benchmark | NFR-PERF-01 | "24 tests in 2.65 s" was not a latency measurement | Part A §6; Part F §5 |
| Added `GET /api/health` | Deployment readiness | Container and cloud health checks need an unauthenticated probe | Part C API table |
| Added Docker Compose for the local application and PostgreSQL | Sprint 1 environment | Team decision: make clean-clone setup reproducible in the scaffold; keep CI/CD and GCP deployment in Lab 5 | Part C §6.3; Part D; GitHub Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2) |

### 3.3 Deliberate gaps and limitations

| Item | Status | Handling |
|---|---|---|
| Anonymous mode (F-05) | Not in Sprint 1 | Contract and schema placeholders exist; implementation and privacy audit in Sprint 2 |
| Multi-choice, long text, yes/no, Likert, rating, integer and date (F-06) | Not in Sprint 1 | Sprint 2; Sprint 1 remains single-choice and short text |
| Eligibility allowlist (F-07) | Not in Sprint 1 | Empty eligibility list means "all respondents" in Sprint 1; management in Sprint 2 |
| Export (F-08) | Not in Sprint 1 | Sprint 3 |
| Rate limiting, refresh tokens, password reset | Not planned | Recorded as technical debt in Part F; outside the course baseline |
| Production-scale performance | Not claimed | Only the measured read-latency target in NFR-PERF-01 |

---

## 4. Verification Evidence Format

Every VERIFIED row in Part F must contain all of the following. A row missing any field remains
PLANNED or IMPLEMENTED.

| Field | Example format |
|---|---|
| Test ID | `STS-F03-04` |
| Test file and test name | `server/tests/response-submission.test.ts` → "rejects a second submission" |
| Command | `npm test -- response-submission.test.ts` |
| Result | `PASS` / `FAIL` / `SKIPPED` |
| Counts | `10 passed, 0 failed, 0 skipped` |
| Commit | Full 40-character SHA of the assessed commit |
| Version | `v0.1.0-sprint1` |
| Evidence location | Terminal output page/screenshot in Part F |

NFR rows additionally record the measurement, target and observed value. For example:

| NFR | Target | Observed | Result |
|---|---|---|---|
| NFR-PERF-01 | p95 < 300 ms | `<measured>` ms over 50 requests | `<PASS/FAIL>` |

---

## 5. Cross-Document Consistency Checks

Before the D1 PDF is compiled, the team must confirm:

- [ ] Every FR in Part A appears in section 2.1.
- [ ] Every BR in Part A appears in section 2.2.
- [ ] Every NFR in Part A appears in section 2.3.
- [ ] Every Sprint 1 AC has a matching STS in Part E.
- [ ] Every STS in Part E appears in this matrix.
- [ ] Every endpoint in Part C has a contract in Part E.
- [ ] Every feature in this inventory appears in Part D.
- [ ] No status is VERIFIED without real evidence in Part F.
- [ ] GitHub Issues [#1–#7](https://github.com/Snnn3/SurveyHub/issues) match this feature allocation and actual acceptance criteria.
- [ ] Compose local environment work is represented in Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2); cloud deployment and CI/CD remain Lab 5 scope.
