# SurveyHub repository workflow

Track issues for every sprint on the shared [SurveyHub Kanban](https://github.com/users/Snnn3/projects/4). Use sprint labels and filtered views within that project to focus on a single sprint. Start with the issue's acceptance criteria and linked feature contract. Record scope and contract changes before implementing them. Link actual issue numbers, feature IDs, acceptance criteria, and dependencies. Reuse an existing issue for the same work.

## Issue to staging

1. Pick a `Ready` issue after its dependencies are complete. Branch from the current sprint staging branch (`sprint-1-staging` for Sprint 1), use a name like `feature/<issue-number>-<slug>`, and move the card to `In progress`.
2. **Analyze.** Read the issue, acceptance criteria, linked contracts, and affected code or docs. Identify dependencies, current behavior, affected callers, and relevant risks. Resolve conflicts between the issue and contract before implementation.
3. **Plan.** Record the intended changes, affected interfaces or data, and a verification step for each acceptance criterion in the issue or working notes. Update the versioned contract before changing behavior.
4. **Implement.** Make the scoped change. For work that requires TDD evidence, retain the failing test run before the fix and the passing run after it.
5. **Test and self-review.** Run the planned checks, inspect the diff against the contract, and check permissions, failure paths, and data integrity where affected. Rerun checks after fixes. Record actual results and any checks still pending.
6. **Request teammate review.** Open a PR into sprint staging, link the issue, include the check results, and move the card to `In review`. If a teammate requests changes or a required check fails, move it to `Fixing`, fix the same branch and PR, rerun checks, and return it to `In review`.
7. Merge into sprint staging only after a teammate approves and required checks pass. Close the feature issue and move it to `Done` once the merge and acceptance criteria are verified.

Keep `Backlog` unlimited. Move issues to `Ready` when their scope is clear and dependencies are complete. Respect the board limits of 3 items in `In progress` and 5 in `In review`.

## Staging to main

Run build, regression, and end-to-end checks on sprint staging before opening a release PR. All changes enter `main` through an approved release PR from sprint staging. If the release PR needs changes, move the release card to `Fixing`, land corrections through reviewed fix PRs into staging, and return the existing release PR to review. Verify the merged commit, record the actual check results, and tag that commit (Sprint 1 uses `v0.1.0-sprint1`). Mark the release issue `Done` when the required submission evidence is ready.

## Repository boundaries

- Keep team-authored specs, contracts, and submission evidence under `docs/` outside `docs/materials/`. The ignored `docs/materials/` directory holds local references and may be absent in a fresh clone.
- Docker Compose is part of Sprint 1 scaffold issue [#2](https://github.com/Snnn3/SurveyHub/issues/2). Keep setup, migration, seed, and test commands reproducible in the README. Use a separate test database and keep real environment values out of Git.
