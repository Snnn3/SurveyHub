# Part A: Software Requirements Specification (SRS) and Product Scope

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
**Course:** CPE 334 Software Engineering, Semester 1/2026
**Deliverable:** Project Deliverable 1 — Part A (10 points)
**Document status:** Baseline v3, aligned with team decisions on 5 November 2026
**Team:** Worawut Sereethai (67070501040), Chanon Lhumsa-ard (67070501059)
**Repository:** <https://github.com/Snnn3/SurveyHub>

> Status note: this document defines requirements and design intent. It does not claim that any
> requirement has been implemented or tested. Implementation status is recorded only in Part F and
> only from real execution output.

---

## 1. Stakeholder Context and Problem Statement

### 1.1 Chosen context

The product is used by a university course team. A **course coordinator** (Survey Owner) needs to
collect structured feedback from **enrolled students** (Respondents) during and after a course. The
current process uses ad hoc forms, shared spreadsheets and chat messages. It has four problems:

1. **No lifecycle control.** A form cannot be reliably opened, closed or versioned, so responses
   arrive after the feedback window and results mix different question sets.
2. **Duplicate and invalid responses.** The same student can submit several times, and required
   questions are often skipped, which distorts totals.
3. **Weak privacy boundaries.** Raw answers are copied into shared files. Students can see each
   other's comments, and there is no clear rule for who may read raw data.
4. **Manual aggregation.** The coordinator counts responses by hand and cannot see a trustworthy
   summary while the survey is open.

### 1.2 Product purpose

SurveyHub lets an organization define surveys, control their lifecycle, collect validated responses
from eligible users, and report aggregate results. The system enforces its rules on the server, not
in the browser.

The theme title also mentions **Review and Feedback**. In this product that requirement is expressed
through **open-text feedback questions** attached to a survey. There is no separate review or rating
entity outside a survey. This interpretation is recorded as a scope decision (ADR-06) and should be
confirmed with the instructor or TA.

### 1.3 Product name and deployment target

- Working name: **SurveyHub**
- Deployment target from Lab 5 onward: Docker image on Google Cloud Run with a managed PostgreSQL
  instance.
- Sprint 1 runs locally with a reproducible seed and does not require cloud resources.

---

## 2. Actors and Responsibilities

| Actor | Description | Responsibilities and permissions |
|---|---|---|
| **Survey Owner** | Course coordinator, lecturer or administrator who runs a survey | Create, edit and delete **draft** surveys; publish and close **own** surveys; view aggregate summaries for **own** surveys; no access to another owner's surveys |
| **Respondent** | Enrolled student or other eligible user | Browse published surveys; submit one validated response per survey; view only their own submission receipt; cannot manage surveys or read another respondent's answers |
| **Unauthenticated user** | A visitor without a valid token | Can call login and health endpoints only; every protected endpoint returns `401` |

### 2.1 Role model decision

Roles are **exclusive**: an account is either `SURVEY_OWNER` or `RESPONDENT`. An owner account cannot
submit a response, even to another owner's survey. This keeps the authorization matrix small and
testable for Sprint 1. If a coordinator also needs to answer a survey, they use a respondent account.

This decision replaces the contradictory statements in the previous draft, where owners were allowed
to open a survey form but forbidden to submit it.

---

## 3. Product Scope

### 3.1 In scope for the whole product

1. Authentication with login, logout, current-user identity and server-side token revocation.
2. Two roles with backend-enforced permissions and per-record ownership.
3. Survey lifecycle: `DRAFT → PUBLISHED → CLOSED`. `CLOSED` is terminal.
4. Survey authoring: title, description, ordered questions, required flags, single-choice options.
5. Question types: single-choice and short text in Sprint 1; multi-choice and 1–5 rating in Sprint 2.
6. Response collection with validation, duplicate prevention and concurrency protection.
7. Identified responses in Sprint 1; anonymous responses with identity/answer separation in Sprint 2.
8. Response eligibility: all authenticated respondents in Sprint 1; an explicit allowlist in Sprint 2.
9. Aggregate summary: response counts, per-option counts and percentages, rating averages, and
   unlinked short-text answers.
10. Rich analysis, individual response browsing and CSV/JSON export in Sprint 3.
11. Docker Compose local development from Sprint 1; CI/CD and GCP deployment from Lab 5 onward.

### 3.2 Sprint 1 scope (Deliverable 1)

- React single-page client, Express/TypeScript API and PostgreSQL through Prisma.
- Seeded accounts only; no self-registration.
- Owner can create a draft survey with questions, update a draft, delete a draft, publish it and close it.
- Respondent can browse published surveys, open the form, submit one valid response and see a receipt.
- Owner can view an aggregate summary of their own survey.
- Business rules BR-01 to BR-09 and the Sprint 1 aggregate portion of BR-11 enforced in the service
  layer, with database constraints where useful.
- Automated verification of rules, persistence and access control, plus selected end-to-end journeys.
- Docker Compose local stack with the application and PostgreSQL, database readiness gating, a named persistent database volume, and a separate test database (GitHub Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2)).

### 3.3 Explicit exclusions

| Excluded item | Reason / planned handling |
|---|---|
| Self-registration, email verification, password reset | Seeded accounts are sufficient for the course; excluded from all sprints |
| Real email or SMS invitations | Not required; eligibility is represented in the database |
| Payments, file upload, matrix/grid questions, skip logic | Outside the theme brief; not planned |
| Multi-tenancy, organization administration, SSO | Outside scope |
| Real-time dashboards or websockets | Not required; summaries are computed on request |
| Native mobile application | Web only |
| CI/CD automation and GCP production deployment | Lab 5; Sprint 1 provides a reproducible local environment only. |
| Production-grade rate limiting and WAF | Recorded as technical debt; basic input limits only |
| Automated scheduled jobs | Sprint 2 auto-close is evaluated lazily on read/write, not by a background worker |

### 3.4 Scope changes from the previous baseline

The previous draft promised editing and deleting surveys in the UI but defined no API for it. It also
used a schema that could not represent multi-select answers, ratings or anonymous responses without a
breaking migration. This baseline records the following approved changes:

| Change | Reason |
|---|---|
| Added `GET /api/surveys/:id`, `PUT /api/surveys/:id`, `DELETE /api/surveys/:id` | Make draft authoring real and make BR-07 testable |
| Added `AnswerOption` join table and `Answer.numberValue` | Support multi-choice and rating without redesigning answers later |
| Added `SurveyEligibility` and `ResponseClaim` models | Make eligibility and anonymous duplicate prevention explicit and forward-compatible |
| Added `User.tokenVersion` and server-side logout | Logout must invalidate the token, not just clear browser state |
| Added `GET /api/health` | Required for container and cloud health checks |
| Replaced the unmeasured performance claim with a defined benchmark | The previous "24 tests in 2.65 s" figure was not a latency measurement |
| Added a Docker Compose application and PostgreSQL stack to Sprint 1 | Team decision: reproducible local setup from the first scaffold; CI/CD and GCP remain Lab 5 work | Part C §6.3; Part D; GitHub Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2) |
| Keep authored deliverable documents in the tracked `docs/` tree | Team workflow decision; only local reference material under `docs/materials/` is ignored | GitHub Issue [#1](https://github.com/Snnn3/SurveyHub/issues/1) |

### 3.5 Requirement summary

| Group | Total | Sprint 1 | Later |
|---|---:|---:|---:|
| Functional requirements | 16 | 10 | 6 |
| Business rules | 11 | 10 (including the Sprint 1 portions of BR-02, BR-08 and BR-11) | 1 |
| Non-functional requirements | 7 | 6 | 1 |
| **Total** | **34** | **26** | **8** |

The Sprint 1 count in this table is the same count used by the Part B coverage matrix. BR-02, BR-08 and
BR-11 have a Sprint 1 portion and a later extension; they are counted once in the Sprint 1 column.

---

## 4. Functional Requirements

Stable IDs are used in Parts B–F. "Sprint" is the planned delivery sprint.

| ID | Requirement | Observable behavior | Sprint |
|---|---|---|---|
| **FR-01** | Authentication and logout | A user can log in with email and password, receives a JWT, and can log out. Logout revokes existing tokens for that account. | 1 |
| **FR-02** | Current user and role | `GET /api/auth/me` returns the authenticated user's id, email, full name and role, and never returns the password hash. | 1 |
| **FR-03** | Create survey draft | A Survey Owner can create a survey with a title, optional description and an ordered set of questions. The new survey is always `DRAFT`. | 1 |
| **FR-04** | Author and edit draft questions | A Survey Owner can add, edit, reorder and remove questions and options while the survey is `DRAFT`. | 1 |
| **FR-05** | Publish survey | A Survey Owner can publish their own valid draft. The status becomes `PUBLISHED` and `publishedAt` is recorded. | 1 |
| **FR-06** | Close survey | A Survey Owner can close their own published survey. The status becomes `CLOSED` and `closedAt` is recorded. | 1 |
| **FR-07** | Browse published surveys | A Respondent can list published surveys and see whether they have already submitted. | 1 |
| **FR-08** | Take and submit survey | A Respondent can open a published survey, answer the questions and submit exactly one response. | 1 |
| **FR-09** | Persisted confirmation | A successful submission is stored in PostgreSQL and the respondent receives a receipt with response id and timestamp. The receipt can be retrieved later. | 1 |
| **FR-10** | Aggregate summary | A Survey Owner can view aggregate results for their own survey: total responses, answered count, option counts and percentages, and unlinked text answers. Rating averages are added when rating questions arrive in Sprint 2. | 1 (aggregate) / 2 (rating average) |
| **FR-11** | Anonymous responses | A survey can run in anonymous mode. Responses are stored without a link to the respondent, while duplicate submission is still prevented. | 2 |
| **FR-12** | Advanced question types | Multi-choice (with min/max selections) and 1–5 rating questions are supported end to end. | 2 |
| **FR-13** | Export results | A Survey Owner can export their own survey results as CSV and JSON. Anonymous surveys export aggregates only. | 3 |
| **FR-14** | Eligibility management | A Survey Owner can restrict a survey to an explicit set of eligible respondents. An empty list means all respondents are eligible. | 2 |
| **FR-15** | Scheduled close | A Survey Owner can set a closing date and time. After that time the survey behaves as closed for submissions. | 2 |
| **FR-16** | Browse individual responses | A Survey Owner can browse individual identified responses for their own survey. Anonymous surveys never expose identity. | 3 |

---

## 5. Business Rules

| ID | Rule | Rejection and observable behavior | Sprint |
|---|---|---|---|
| **BR-01** | One response per respondent per survey | A second submission by the same respondent returns `409 DUPLICATE_SUBMISSION`. Exactly one response is stored, including under concurrent requests. Enforced by a service check, a `ResponseClaim` unique constraint and an identified-response unique constraint. | 1 |
| **BR-02** | Survey state guard | Responses are accepted only while the survey is `PUBLISHED` and, from Sprint 2, before `closesAt`. A `DRAFT` or `CLOSED` survey returns `400 SURVEY_NOT_ACCEPTING_RESPONSES`. | 1 (state) / 2 (scheduled close) |
| **BR-03** | Answer validation | Every required question must be answered. Each answer must match its question type. A selected option must belong to that question. Text is trimmed, non-empty when required, and at most 2,000 characters. Invalid input returns `400 INVALID_ANSWER` or `400 MISSING_REQUIRED_QUESTIONS`. | 1 |
| **BR-04** | Survey ownership boundary | Only the owner may read, update, delete, publish, close or summarize a survey. A non-owner receives `403 FORBIDDEN_OWNERSHIP`; an unknown survey id receives `404 NOT_FOUND`. | 1 |
| **BR-05** | Cross-response privacy | A respondent may retrieve only their own response receipt. Requesting another respondent's receipt returns `403 FORBIDDEN_CROSS_RESPONSE_ACCESS` without returning any answer data. | 1 |
| **BR-06** | Publish structure | A survey can be published only if it has at least one question, every choice question has at least two options, every rating scale has `1 ≤ scaleMin < scaleMax ≤ 10`, and every prompt is non-empty. Otherwise `400 INVALID_QUESTION_STRUCTURE`. | 1 |
| **BR-07** | Immutable structure after publication | Questions and options cannot be added, edited, reordered or removed after publication. `PUT /api/surveys/:id` returns `400 SURVEY_NOT_EDITABLE`. Metadata edits are also blocked in Sprint 1 for simplicity. | 1 |
| **BR-08** | Response eligibility | Only authenticated users with the `RESPONDENT` role may submit. From Sprint 2, if a survey has eligibility entries, the respondent must be on the list; otherwise `403 NOT_ELIGIBLE`. In Sprint 1 an empty eligibility list means all respondents are eligible. | 1 (role) / 2 (allowlist) |
| **BR-09** | Terminal closed state | `CLOSED` is terminal. Publishing a published or closed survey, or closing a draft or closed survey, returns `400 INVALID_STATE_TRANSITION`. | 1 |
| **BR-10** | Anonymous identity separation | In anonymous mode, `SurveyResponse.respondentId` is `NULL`; no name, email, IP address or user agent is stored with the response; the `ResponseClaim` row records only that the user submitted, not which response is theirs. Owners see aggregates and unlinked text only. | 2 |
| **BR-11** | Result privacy | Aggregate and export responses never include respondent identity fields. Identified raw-response browsing is available only to the owning Survey Owner and only for identified surveys. | 1 (aggregate) / 3 (raw) |

### 5.1 Access-to-raw-data policy

The theme brief requires an explicit raw-data policy.

| Caller | Aggregate summary | Individual response content | Respondent identity |
|---|---|---|---|
| Respondent | No | Own receipt only | Own account |
| Survey Owner (own survey, identified mode) | Yes | From Sprint 3, through an explicit response browser and export | From Sprint 3, included only in the identified raw export |
| Survey Owner (own survey, anonymous mode) | Yes | Unlinked text answers in the summary; no response-level identity | Never |
| Survey Owner (another owner's survey) | No | No | No |
| Unauthenticated | No | No | No |

Sprint 1 implements the aggregate column only. Short-text answers appear in the summary as a list of
strings with no respondent name, email or response id. This is deliberate: the previous draft claimed
owners could see only aggregates while also returning raw text samples, which was contradictory.

---

## 6. Non-Functional Requirements

Each NFR has a measurable target and a named verification method. Targets are compared with actual
results only in Part F, after execution.

| ID | Quality attribute | Measurable target | Verification method | Sprint |
|---|---|---|---|---|
| **NFR-SEC-01** | Protected API enforcement | 100% of protected endpoints return `401` with no private data when called without a token or with an invalid token | Parameterized integration test that enumerates every protected route (`server/tests/security-matrix.test.ts`) | 1 |
| **NFR-SEC-02** | Role and ownership enforcement | 100% of forbidden role/ownership operations return `403` and leave the database unchanged | Role/ownership matrix integration tests across all protected operations | 1 |
| **NFR-SEC-03** | Password storage | Every stored password hash uses bcrypt cost 10 (`$2b$10$` prefix). No plaintext password appears in the database or API responses. | Integration test queries `users.password_hash` and asserts the prefix; response-shape assertions | 1 |
| **NFR-SEC-04** | Token revocation | A token used before logout returns `401 TOKEN_REVOKED` after logout | Integration test: login, call `/me`, logout, call `/me` with the same token | 1 |
| **NFR-PERF-01** | Read latency | p95 latency of `GET /api/surveys/:id/form` is below 300 ms over 50 sequential requests on the local development environment (Node.js 20+ and PostgreSQL 16+ on the same machine; actual versions are recorded in Part F) | `server/scripts/benchmark-read.ts` records p50/p95/p99 and writes a JSON result | 1 |
| **NFR-DATA-01** | Relational integrity and durability | Foreign keys and unique constraints exist; a submitted response is still retrievable after an API restart and after a database server restart | Migration inspection plus a documented restart check against the seeded environment | 1 |
| **NFR-PRIV-01** | Anonymous unlinkability | In anonymous mode, `survey_responses.respondent_id IS NULL` for 100% of anonymous responses, and no identity field exists in the answers or API output | Database audit test and API response-shape assertions | 2 |

**Explicit non-target:** the project does not claim production-scale throughput, high availability or
sub-second p99 latency. Those are outside the course scope.

---

## 7. Assumptions and Architecture Decisions

### 7.1 Assumptions

The following assumptions are treated as true for planning. If one changes, the affected requirements,
contracts and tests are revised and the change is recorded.

| ID | Assumption | Impact if false |
|---|---|---|
| **A-01** | Both students have a working local Node.js and PostgreSQL environment and can run the project from a clean clone. | Reproduction and evidence capture are blocked; use the isolated local cluster procedure documented in Part F. |
| **A-02** | Sprint 1 uses seeded accounts; no self-registration or email delivery is required. | Authentication scope and the seed/login flow must be redesigned. |
| **A-03** | One account has exactly one role; a person who needs both roles uses two accounts. | The role matrix and authorization tests must be extended. |
| **A-04** | A survey is owned by one owner account; ownership transfer is not required. | The ownership model and BR-04 change. |
| **A-05** | Timestamps are handled in UTC on the server and displayed in local time by the client. | Scheduled close and receipt timestamps become ambiguous. |
| **A-06** | Demo data is synthetic; no real student data or production secrets are used. | The raw-data policy and submission may violate privacy rules. |
| **A-07** | PostgreSQL supports the constraints and transactional behaviour used by Prisma. | The duplicate guard and data-integrity claims need a different mechanism. |

### 7.2 Architecture decisions

### ADR-01 — Stack

React 18 + Vite + TypeScript + Tailwind CSS on the client; Node.js 20+ + Express + TypeScript on the
server; Prisma ORM with PostgreSQL 16+. The team already used this stack in Labs 1–4. A modular
monolith is sufficient and keeps deployment to one API container plus one database.

### ADR-02 — Authentication and revocation

JWT in the `Authorization: Bearer` header, signed with HS256, containing `sub`, `role` and `ver`.
`User.tokenVersion` is compared on every authenticated request. Logout increments the version, which
revokes every token issued to that account. Tokens expire after 8 hours. There are no refresh tokens;
the user logs in again after expiry. This is a deliberate, testable session design rather than a
client-only logout that leaves the token valid.

### ADR-03 — Duplicate-submission strategy

Defense in depth:

1. The service checks for an existing `ResponseClaim` and returns a friendly `409`.
2. A unique constraint on `ResponseClaim(surveyId, userId)` prevents a race.
3. `SurveyResponse(surveyId, respondentId)` is also unique for identified responses.
4. Prisma error `P2002` is translated to `409 DUPLICATE_SUBMISSION`.

### ADR-04 — Seeded accounts only

Sprint 1 uses four seeded accounts: two owners and two respondents. Self-registration and password
recovery are excluded. Demo passwords are synthetic and documented only in the private handoff or
local seed.

### ADR-05 — Forward-compatible data model

The Sprint 1 schema already contains the structures needed by later sprints:

- `AnswerOption` join table, so one answer can reference several options for multi-choice.
- `Answer.numberValue`, so ratings do not need a text hack.
- `SurveyEligibility`, so eligibility can be switched on without a new table.
- Nullable `SurveyResponse.respondentId` plus `ResponseClaim`, so anonymous mode does not require a
  breaking migration.

`schema.prisma` is the single source of truth; migrations are committed.

### ADR-06 — Theme interpretation

The survey's short-text questions are the "review and feedback" element. A separate review entity is
not built. This avoids inventing a second domain that the stakeholder brief does not require.

### ADR-07 — Raw-data policy

Defined in section 5.1. The rule is: aggregate data is available to the owner; individual response
content is limited to the owner's own survey; respondent identity is never exposed to other
respondents, and is never exposed for anonymous surveys.

### ADR-08 — Time handling

All timestamps are stored in UTC (`timestamptz` semantics through Prisma `DateTime`). The API returns
ISO 8601 strings. The client displays local time. Scheduled close compares `closesAt` with the server
clock.

### ADR-09 — Test database

Integration tests use a separate PostgreSQL database (`surveyhub_test`) and run with
`jest --runInBand`. Each suite truncates tables in dependency order before seeding fixtures. Tests
never touch the development or demo database. This is required for reproducible evidence.

### ADR-10 — Final video length

The course handouts disagree: the group specification and Final Delivery section 2 allow up to
10 minutes, while Final Delivery section 3.5 says a maximum of 4 minutes. The team will target
**4 minutes** (the stricter limit) unless the instructor or TA confirms otherwise.

---

### ADR-11 — Docker Compose in Sprint 1

**Decision:** Sprint 1 Issue #2 provides a root-level Compose setup for the application and PostgreSQL. The database has a health check, a named persistent volume, and separate development and test databases. The application waits for database readiness. CI/CD and GCP deployment remain Lab 5 work.

**Reason:** the team asked for a reproducible, containerized local environment as part of the first scaffold. This supersedes the planning draft's Lab 5 timing for Docker.

**Verification:** a clean-clone setup, health check, migration, seed, test-database isolation and persistence check are recorded in Part F after they are run.

## 8. Questions and Resolutions

| # | Question | Resolution |
|---|---|---|
| Q1 | How do we prevent two simultaneous submissions from the same respondent? | Service pre-check plus `ResponseClaim` unique constraint plus identified-response unique constraint. Catch `P2002` and return `409`. Tested with concurrent requests. |
| Q2 | Who may read raw answers? | The owner of the survey, for their own identified survey, from Sprint 3. Respondents see only their own receipt. Anonymous surveys never expose identity. Sprint 1 exposes aggregates and unlinked text only. |
| Q3 | What happens if an owner edits questions after publication? | Rejected with `400 SURVEY_NOT_EDITABLE`. Metadata edits are also blocked in Sprint 1 to keep the published contract stable. |
| Q4 | How is logout made real with stateless JWT? | `User.tokenVersion` is embedded in the token and checked on every request. Logout increments it. Old tokens return `401 TOKEN_REVOKED`. |
| Q5 | Who is eligible in Sprint 1? | Every authenticated `RESPONDENT`. The `SurveyEligibility` table is present but empty, which means "open to all respondents". Sprint 2 adds allowlist management. |
| Q6 | Does anonymous mode need cryptography? | No. It needs separation: the response row has no user link, the claim row has no response link, and no request metadata is stored. Residual risk: a database administrator could correlate timestamps. That risk is documented rather than overclaimed. |
| Q7 | How do we model multi-select and ratings without redesigning later? | `AnswerOption` join table for selected options; `Answer.numberValue` for ratings; `Question.scaleMin/scaleMax/minSelections/maxSelections`. |
| Q8 | What is the evidence standard for this project? | Only real command output, commit ids, PR links and screenshots from the submitted release count. Planned checks are labelled PLANNED and are never reported as PASS. |
| Q9 | The handouts give different video limits. Which do we follow? | 4 minutes unless the TA confirms 10. |
| Q10 | Student ids end in 9 and 0; why Theme 10? | Theme 10 matches the partner's last digit (0). Theme 9 was also available but Survey was the team's preference. Recorded here as the theme decision. |

---

## 9. Traceability and Status

- Every FR, BR and NFR in this document is mapped to a feature, sprint, acceptance criterion and
  verification target in **Part B**.
- Feature contracts for Sprint 1 are in **Part E**.
- The verification plan and evidence-collection procedure are in **Part F**.
- No requirement in this SRS is marked complete until the corresponding test has run against the
  submitted commit and the result is recorded in Part F.
