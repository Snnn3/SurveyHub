# SurveyHub — Project Deliverable 1

**CPE 334 · Theme 10 · Sprint 1**

- **Status:** Issue [#1](https://github.com/Snnn3/SurveyHub/issues/1) — scope and contracts; teammate review is pending.
- **Team and student IDs:** Add the confirmed team-member names and IDs before submission.
- **Repository:** [SurveyHub](https://github.com/Snnn3/SurveyHub)
- **Shared Kanban:** [SurveyHub project](https://github.com/users/Snnn3/projects/4), used across all sprints.
- **Assessed release:** Pending Issue [#7](https://github.com/Snnn3/SurveyHub/issues/7).

## Deliverable contents and PDF assembly order

Assemble the following in order. Include the full content of each linked document and its subsections,
then replace links with page references in the compiled PDF. Fill actual verification evidence only after
the assessed release exists.

| Part | Required content | Source | Points |
|---|---|---|---:|
| A | SRS and product scope | [SRS](srs.md) | 10 |
| B | Feature inventory and requirements traceability | [Features](features.md) and [traceability](traceability.md) | 10 |
| C | System-level Software Design Specification | [System design](system-sds.md) | 15 |
| D | Three-sprint product development plan | [Sprint plan](sprints/plan.md) | 5 |
| E | Sprint 1 contracts and test specifications; include linked files in their listed order | [DoD and contents](sprints/sprint-1/README.md), [F-01](sprints/sprint-1/f-01.md), [F-02](sprints/sprint-1/f-02.md), [F-03](sprints/sprint-1/f-03.md), [F-04](sprints/sprint-1/f-04.md), [shared test specifications](sprints/sprint-1/sts.md) | 20 |
| F | Verification plan, demo scenarios and engineering process evidence | [Verification](verification.md) | 20 |

## Approved team decisions reflected in this baseline

- Theme 10 is SurveyHub, a university course feedback and survey system.
- The agreed stack remains React/Vite/TypeScript, Express/TypeScript, Prisma and PostgreSQL.
- Docker Compose with the application and PostgreSQL is part of Sprint 1 scaffold Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2). Keep a persistent database volume and a separate test database. CI/CD and GCP deployment remain Lab 5 work.
- The shared Kanban serves all sprints. Use sprint labels and filtered views; keep Backlog unlimited, with WIP limits of 3 in `In progress` and 5 in `In review`. Include `Fixing` for requested PR changes and failed required checks.
- Feature PRs merge into the current sprint staging branch. Only an approved release PR from staging enters `main`.
- Team-authored deliverable docs are committed under `docs/`. `docs/materials/` is ignored local reference material and is not part of the deliverable source tree.

## Submission completion

Before submission, replace the pending release status with the assessed tag and full commit SHA, add actual
test outputs and screenshots, verify every acceptance criterion, confirm team details, and inspect the
compiled PDF page references. Planned checks and placeholders must never be reported as passing.
