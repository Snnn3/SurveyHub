# Part E: Sprint 1 Feature Contracts and Software Test Specifications

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
**Course:** CPE 334 Software Engineering, Semester 1/2026
**Deliverable:** Project Deliverable 1 — Part E (20 points)
**Document status:** Contract baseline v3, aligned with team decisions on 5 November 2026
**Related documents:** Part A (requirements), Part B (traceability), Part C (system design)

> Status note: these are **pre-implementation contracts**. No acceptance criterion is marked passing.
> Test IDs are planned; their results are recorded in Part F only after execution on the assessed
> commit. The previous draft contained fabricated terminal logs and SHAs; those are removed.
>
> These contracts are versioned under `docs/sprints/sprint-1/` and linked to the shared Kanban issues.
> Acceptance criteria and test IDs are the implementation contract. Part F records actual results only
> after execution; no planned check is described as passing.

---

### Part E file order

1. This file: product Definition of Done.
2. [F-01 — Authentication, session and RBAC](f-01.md) — GitHub Issue [#3](https://github.com/Snnn3/SurveyHub/issues/3).
3. [F-02 — Survey lifecycle and authoring](f-02.md) — GitHub Issue [#4](https://github.com/Snnn3/SurveyHub/issues/4).
4. [F-03 — Survey taking, submission and response rules](f-03.md) — GitHub Issue [#5](https://github.com/Snnn3/SurveyHub/issues/5).
5. [F-04 — Aggregate summary](f-04.md) — GitHub Issue [#6](https://github.com/Snnn3/SurveyHub/issues/6).
6. [Shared endpoints and test specifications](sts.md) — shared by Issues [#1](https://github.com/Snnn3/SurveyHub/issues/1) and [#7](https://github.com/Snnn3/SurveyHub/issues/7).

## 1. Product Definition of Done (DoD)

A Sprint 1 feature is Done only when all of the following are true and evidenced:

1. **Behaviour:** every acceptance criterion is implemented through the UI, API and database.
2. **Rules:** business rules are enforced on the server, not only in the client.
3. **Tests:** planned unit, API/database integration and selected E2E tests exist and run.
4. **Negative cases:** boundary, invalid and forbidden cases are tested, not only happy paths.
5. **Persistence:** data is written to PostgreSQL and can be retrieved after a reload and a restart.
6. **Review:** a teammate reviewed the PR and left a specific technical check, question or finding.
7. **Integration:** the feature was merged into `sprint-1-staging` and the full suite passed there.
8. **Documents:** the contract, API shape and README are current.
9. **Disclosure:** any failed, skipped or incomplete work is listed in Part F.
10. **Evidence:** test output, screenshots and commit ids are real and identify the same version.

A feature is **not** Done because an AI agent says so, because a screenshot exists, or because an old
test run passed.

---
