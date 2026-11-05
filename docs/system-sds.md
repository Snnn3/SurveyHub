# Part C: System-Level Software Design Specification (SDS)

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
**Course:** CPE 334 Software Engineering, Semester 1/2026
**Deliverable:** Project Deliverable 1 — Part C (15 points)
**Document status:** Baseline v4, aligned with team decisions on 5 November 2026
**Related documents:** Part A (requirements), Part B (traceability), Part E (feature contracts)

> Status note: this is a design document. It does not claim that the system is implemented or
> deployed. Implementation and execution evidence belong to Part F.

---

## 1. Architecture and Component Responsibilities

### 1.1 Architecture style

SurveyHub is a **three-tier modular monolith**:

```mermaid
flowchart TD
    subgraph Client["Client tier"]
        UI["React 18 SPA<br/>Vite + TypeScript + Tailwind"]
        State["Auth context<br/>current user + token"]
        Router["React Router<br/>protected routes"]
    end

    subgraph API["Application tier"]
        Express["Express + TypeScript"]
        Auth["authenticateJWT<br/>signature + tokenVersion"]
        Guard["Role and ownership guards"]
        Controller["Controllers<br/>HTTP envelope + validation"]
        Service["Domain services<br/>business rules"]
        Prisma["Prisma ORM"]
    end

    subgraph Data["Data tier"]
        PG[("PostgreSQL 16+<br/>constraints, indexes, migrations")]
    end

    UI --> State
    UI --> Router
    Router -->|"JSON over HTTPS<br/>Bearer JWT"| Express
    Express --> Auth
    Auth --> Guard
    Guard --> Controller
    Controller --> Service
    Service --> Prisma
    Prisma --> PG
```

A modular monolith is deliberate: one deployable API container, one database, clear module
boundaries, and no distributed-system overhead for a two-person course project.

### 1.2 Stack decision

| Layer | Technology | Reason |
|---|---|---|
| Client | React 18, Vite, TypeScript, Tailwind CSS, React Router, Axios | Same stack as Labs 1–4; fast local development; static build |
| API | Node.js 20+, Express 4, TypeScript, Zod | Simple REST, typed validation, easy Supertest integration |
| ORM | Prisma 6 | Typed schema, migrations, seed, PostgreSQL constraints |
| Database | PostgreSQL 16+ (local verification on 18.1) | Relational integrity, transactions, mature Docker and Cloud SQL support |
| Auth | `jsonwebtoken`, `bcryptjs` | Standard JWT and password hashing; no external identity provider |
| Tests | Jest, ts-jest, Supertest, Playwright | Unit, API/DB integration and E2E at the required levels |
| Local container workflow | Docker Compose for the application and PostgreSQL (Sprint 1); GitHub Actions and GCP Cloud Run + Cloud SQL (Lab 5) | Reproducible local development first, course deployment later |

### 1.3 Layer responsibilities

**Client tier**

- Renders role-aware routes and forms.
- Performs only convenience validation; the server repeats every check.
- Holds the JWT and current-user state.
- Shows loading, empty, validation and error states.
- Never decides authorization from a hidden button. Hiding a control is not a security boundary.

**Application tier**

- `authenticateJWT`: verifies signature and expiry, loads the user, compares `tokenVersion`.
- `requireRole`: rejects a role that is not allowed for the route.
- Ownership checks live in services, because ownership depends on the record, not only the route.
- Controllers validate input with Zod and map errors to one JSON envelope.
- Services enforce business rules and run multi-row writes in a Prisma transaction.
- Prisma is the only component that talks to PostgreSQL.

**Data tier**

- Primary keys, foreign keys, unique constraints and indexes enforce structural integrity.
- Transactions protect response + answers + claim creation.
- Migrations are versioned in `server/prisma/migrations/`.
- Seed data is reproducible and idempotent.

### 1.4 Business-rule enforcement map

| Rule | Service layer | Database layer |
|---|---|---|
| BR-01 one response per respondent | Pre-check claim, catch `P2002` | `ResponseClaim(survey_id, user_id)` unique; identified `SurveyResponse(survey_id, respondent_id)` unique |
| BR-02 state guard | Check `status = PUBLISHED` and `closesAt` | No direct constraint; status is an enum |
| BR-03 answer validation | Validate required, exact value shape, option ownership, type-specific text length, rating and integer bounds, date validity | `Answer(response_id, question_id)` unique; FKs |
| BR-04 ownership | Compare `survey.ownerId` with current user | FK `owner_id` |
| BR-05 cross-response privacy | Compare `response.respondentId` with current user | FK `respondent_id` |
| BR-06 publish structure | Validate question count, type-specific options, selection/integer bounds and prompts | Service-level only |
| BR-07 immutable structure | Reject update when status is not DRAFT | Service-level only |
| BR-08 eligibility | Role check; optional allowlist check | `SurveyEligibility(survey_id, user_id)` unique |
| BR-09 terminal state | State-transition check | Enum status |
| BR-10 anonymous separation | Write `respondentId = NULL`; create claim without response link | Nullable `respondent_id`; separate `response_claims` table |
| BR-11 result privacy | Build summary without identity fields | No identity columns in aggregate queries |

---

## 2. Data Model

### 2.1 Entity-relationship diagram

```mermaid
erDiagram
    User ||--o{ Survey : "owns"
    User ||--o{ SurveyResponse : "submits (identified only)"
    User ||--o{ ResponseClaim : "claims"
    User ||--o{ SurveyEligibility : "is eligible"

    Survey ||--o{ Question : "contains"
    Survey ||--o{ SurveyResponse : "receives"
    Survey ||--o{ ResponseClaim : "tracks"
    Survey ||--o{ SurveyEligibility : "restricts"

    Question ||--o{ Option : "has"
    Question ||--o{ Answer : "is answered by"

    SurveyResponse ||--o{ Answer : "contains"
    Answer ||--o{ AnswerOption : "selects"
    Option ||--o{ AnswerOption : "is selected in"
```

### 2.2 Design decisions

1. **Answers are typed.** One `Answer` row exists per question per response. Single-choice,
   multi-choice, yes/no and Likert answers reference options through `AnswerOption`; short and long
   text use `textValue`; rating and integer answers use `numberValue`; date answers use `dateValue`.
   The service validates that each answer has the value shape required by its question type.
2. **One answer row per question per response.** `Answer(response_id, question_id)` is unique. A
   multi-choice answer still has one `Answer` row and several `AnswerOption` rows.
3. **Duplicate prevention is separate from response storage.** `ResponseClaim` records that a user
   submitted a survey. In anonymous mode it has no link to the response, so the system can prevent a
   second submission without knowing which response belongs to the user.
4. **Eligibility is a table, not a boolean.** An empty eligibility list means "all respondents" in
   Sprint 1. Populated lists restrict submission in Sprint 2.
5. **Closed is terminal.** `publishedAt`, `closesAt` and `closedAt` capture lifecycle history.
6. **No user deletion in scope.** Foreign keys use `Restrict` where deleting a user or survey would
   destroy audit-relevant data. Draft survey deletion is handled by the service and cascades only
   through structure that has no responses.

### 2.3 Full Prisma schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  SURVEY_OWNER
  RESPONDENT
}

enum SurveyStatus {
  DRAFT
  PUBLISHED
  CLOSED
}

enum SurveyMode {
  IDENTIFIED
  ANONYMOUS
}

enum QuestionType {
  SINGLE_CHOICE
  MULTI_CHOICE
  SHORT_TEXT
  LONG_TEXT
  YES_NO
  LIKERT
  RATING
  INTEGER
  DATE
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  fullName     String   @map("full_name")
  role         Role
  tokenVersion Int      @default(0) @map("token_version")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  ownedSurveys Survey[]           @relation("SurveyOwner")
  responses    SurveyResponse[]   @relation("ResponseRespondent")
  claims       ResponseClaim[]
  eligibility  SurveyEligibility[]

  @@map("users")
}

model Survey {
  id          String       @id @default(uuid())
  title       String
  description String?
  status      SurveyStatus @default(DRAFT)
  mode        SurveyMode   @default(IDENTIFIED)
  ownerId     String       @map("owner_id")
  owner       User         @relation("SurveyOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  publishedAt DateTime?    @map("published_at")
  closesAt    DateTime?    @map("closes_at")
  closedAt    DateTime?    @map("closed_at")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  questions   Question[]
  responses   SurveyResponse[]
  claims      ResponseClaim[]
  eligibility SurveyEligibility[]

  @@index([ownerId, status])
  @@index([status, closesAt])
  @@map("surveys")
}

model SurveyEligibility {
  id        String   @id @default(uuid())
  surveyId  String   @map("survey_id")
  survey    Survey   @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([surveyId, userId])
  @@index([userId])
  @@map("survey_eligibility")
}

model Question {
  id            String       @id @default(uuid())
  surveyId      String       @map("survey_id")
  survey        Survey       @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  prompt        String
  questionType  QuestionType @map("question_type")
  isRequired    Boolean      @default(true) @map("is_required")
  orderIndex    Int          @default(0) @map("order_index")
  minSelections Int?         @map("min_selections")
  maxSelections Int?         @map("max_selections")
  numberMin     Int?         @map("number_min")
  numberMax     Int?         @map("number_max")

  options Option[]
  answers Answer[]

  @@index([surveyId, orderIndex])
  @@map("questions")
}

model Option {
  id         String   @id @default(uuid())
  questionId String   @map("question_id")
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  label      String
  orderIndex Int      @default(0) @map("order_index")

  answerOptions AnswerOption[]

  @@unique([questionId, label])
  @@index([questionId, orderIndex])
  @@map("options")
}

model SurveyResponse {
  id           String   @id @default(uuid())
  surveyId     String   @map("survey_id")
  survey       Survey   @relation(fields: [surveyId], references: [id], onDelete: Restrict)
  respondentId String?  @map("respondent_id")
  respondent   User?    @relation("ResponseRespondent", fields: [respondentId], references: [id], onDelete: Restrict)
  submittedAt  DateTime @default(now()) @map("submitted_at")

  answers Answer[]

  @@unique([surveyId, respondentId])
  @@index([surveyId, submittedAt])
  @@map("survey_responses")
}

model ResponseClaim {
  id        String   @id @default(uuid())
  surveyId  String   @map("survey_id")
  survey    Survey   @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([surveyId, userId])
  @@index([userId])
  @@map("response_claims")
}

model Answer {
  id          String         @id @default(uuid())
  responseId  String         @map("response_id")
  response    SurveyResponse @relation(fields: [responseId], references: [id], onDelete: Cascade)
  questionId  String         @map("question_id")
  question    Question       @relation(fields: [questionId], references: [id], onDelete: Restrict)
  textValue   String?        @map("text_value")
  numberValue Int?           @map("number_value")
  dateValue   DateTime?      @map("date_value") @db.Date

  selectedOptions AnswerOption[]

  @@unique([responseId, questionId])
  @@index([questionId])
  @@map("answers")
}

model AnswerOption {
  id       String @id @default(uuid())
  answerId String @map("answer_id")
  answer   Answer @relation(fields: [answerId], references: [id], onDelete: Cascade)
  optionId String @map("option_id")
  option   Option @relation(fields: [optionId], references: [id], onDelete: Restrict)

  @@unique([answerId, optionId])
  @@index([optionId])
  @@map("answer_options")
}
```

### 2.4 Constraints added by SQL migration

Prisma cannot express every check, so the initial migration adds:

```sql
ALTER TABLE surveys
  ADD CONSTRAINT survey_title_length CHECK (char_length(title) BETWEEN 1 AND 120);

ALTER TABLE questions
  ADD CONSTRAINT question_prompt_length CHECK (char_length(prompt) BETWEEN 1 AND 500),
  ADD CONSTRAINT question_selection_bounds CHECK (
    min_selections IS NULL OR max_selections IS NULL OR
    (min_selections >= 1 AND min_selections <= max_selections)
  ),
  ADD CONSTRAINT question_integer_bounds CHECK (
    number_min IS NULL OR number_max IS NULL OR number_min <= number_max
  );

ALTER TABLE answers
  ADD CONSTRAINT answer_text_length CHECK (text_value IS NULL OR char_length(text_value) <= 10000);
```

These constraints are defence in depth. The service still returns friendly validation messages; the
database is the last line of defence. Type-specific limits remain service-validated: Sprint 1 short
text is limited to 2,000 characters, Sprint 2 long text to 10,000, rating to 1–5, and integer answers
to their question's configured bounds.

### 2.5 Migration and seed strategy

- `npm run db:migrate` → `prisma migrate dev` locally; `prisma migrate deploy` in deployment.
- Migration files are committed. No manual schema edits in the database.
- `npm run db:seed` is idempotent: it uses `upsert` for users, surveys, questions and options.
- Seed data is synthetic and creates no responses or claims. Tests create their own response fixtures
  so counts are predictable. No real student data is used.

**Seeded accounts**

| Role | Email | Password (demo only) | Purpose |
|---|---|---|---|
| SURVEY_OWNER | `owner1@survey.local` | `Password123!` | Main owner; publishes survey 1 |
| SURVEY_OWNER | `owner2@survey.local` | `Password123!` | Ownership-boundary tests |
| RESPONDENT | `resp1@survey.local` | `Password123!` | Normal submission; duplicate test |
| RESPONDENT | `resp2@survey.local` | `Password123!` | Second respondent; cross-response test |

**Seeded surveys**

| Survey | Status | Questions | Purpose |
|---|---|---|---|
| CPE 334 Midterm Feedback | PUBLISHED | Single-choice + short text | Normal journey |
| Internal Team Survey Draft | DRAFT | Single-choice | Draft/publish tests |
| Owner 2 Course Pulse | PUBLISHED | Rating (Sprint 2 placeholder) | Cross-owner tests |

### 2.6 Test database

- Integration tests use `DATABASE_URL_TEST` pointing to `surveyhub_test`.
- A global setup runs migrations and truncates tables in dependency order:
  `answer_options → answers → response_claims → survey_responses → options → questions → survey_eligibility → surveys → users`.
- Tests run with `jest --runInBand` so database state is deterministic.
- No test mocks Prisma for persistence or permission tests. Mocks are allowed only for isolated unit
  tests of pure functions.

---

## 3. UI Structure and Behaviour

### 3.1 Routes

| Route | Role | Purpose |
|---|---|---|
| `/login` | Public | Login form |
| `/owner/surveys` | SURVEY_OWNER | Owner survey list with status badges and actions |
| `/owner/surveys/new` | SURVEY_OWNER | Create a draft survey and questions |
| `/owner/surveys/:id/edit` | SURVEY_OWNER | Edit a draft survey |
| `/owner/surveys/:id/summary` | SURVEY_OWNER | Aggregate summary |
| `/surveys` | RESPONDENT | Published survey catalogue |
| `/surveys/:id/take` | RESPONDENT | Survey form |
| `/surveys/:id/confirmation/:responseId` | RESPONDENT | Submission receipt |
| `/` | Any authenticated | Redirect by role |
| `*` | Any | Not-found page |

`ProtectedRoute` checks authentication and role on the client for navigation only. Every API request
is independently authorized on the server.

### 3.2 Shared UI states

| State | Behaviour |
|---|---|
| Loading | Skeleton or spinner; submit button disabled while a request is pending |
| Empty | Explanatory text and a relevant action, e.g. "No surveys yet — create your first survey" |
| Validation | Inline field message, `aria-invalid`, focus moves to the first invalid field |
| Error banner | Red banner with the server's safe message; `aria-live="polite"` |
| Success | Confirmation card or toast; no raw error codes shown to end users |
| Access denied | A 403 page with a link back to the user's own area; no record data is rendered |
| Not found | A 404 page; does not reveal whether a record exists for another user |

### 3.3 Accessibility and usability conventions

- Every input has a visible label; placeholders are not labels.
- Keyboard navigation works for the builder, radio groups and form submission.
- Colour is not the only status indicator; badges include text.
- Error messages describe what to fix.
- The layout is responsive down to 375 px.
- Destructive actions (delete draft, close survey) require confirmation.

---

## 4. API Design and Conventions

### 4.1 Envelope

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      { "field": "title", "message": "Title is required." }
    ]
  }
}
```

Rules:

- `message` is safe for end users and never contains SQL, stack traces or secrets.
- `details` is optional and contains field-level validation messages.
- HTTP status codes carry the class of error; the `code` is stable for tests and clients.
- All timestamps are ISO 8601 UTC strings. Date answers use the date-only `YYYY-MM-DD` form.
- All ids are UUID strings.
- JSON request bodies are limited to 100 kB.

### 4.2 Status codes

| Code | Meaning |
|---|---|
| 200 | Successful read or update |
| 201 | Resource created |
| 204 | Successful delete with no body |
| 400 | Validation or invalid state transition |
| 401 | Missing, invalid, expired or revoked token |
| 403 | Authenticated but not allowed (role, ownership, eligibility, cross-response) |
| 404 | Record not found |
| 409 | Duplicate submission |
| 500 | Unexpected server error; generic message only |

### 4.3 Error codes

| Code | HTTP | Used when |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed body or invalid field |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_REQUIRED` | 401 | No Authorization header |
| `INVALID_TOKEN` | 401 | Bad signature, expired or malformed token |
| `TOKEN_REVOKED` | 401 | Token version no longer matches the user |
| `FORBIDDEN_ROLE` | 403 | Role not allowed for the operation |
| `FORBIDDEN_OWNERSHIP` | 403 | Record belongs to another owner |
| `FORBIDDEN_CROSS_RESPONSE_ACCESS` | 403 | Respondent requests another respondent's receipt |
| `NOT_ELIGIBLE` | 403 | Respondent is not on the allowlist (Sprint 2) |
| `NOT_FOUND` | 404 | Unknown id |
| `DUPLICATE_SUBMISSION` | 409 | Claim already exists or unique violation |
| `SURVEY_NOT_ACCEPTING_RESPONSES` | 400 | Survey is draft, closed or past `closesAt` |
| `MISSING_REQUIRED_QUESTIONS` | 400 | Required answers absent |
| `INVALID_ANSWER` | 400 | Wrong value shape, foreign option, duplicate question, invalid type-specific bound or date |
| `INVALID_QUESTION_STRUCTURE` | 400 | Publish requirements not met |
| `SURVEY_NOT_EDITABLE` | 400 | Update/delete attempted after publication |
| `INVALID_STATE_TRANSITION` | 400 | Publish/close transition not allowed |
| `INTERNAL_ERROR` | 500 | Unhandled error |

### 4.4 Endpoint table

All endpoints except login and health require `Authorization: Bearer <token>`.

| # | Method | Path | Auth | Allowed role | Purpose |
|---:|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | Public | — | Authenticate and return JWT |
| 2 | GET | `/api/auth/me` | Token | Any | Current user identity and role |
| 3 | POST | `/api/auth/logout` | Token | Any | Increment `tokenVersion` and revoke tokens |
| 4 | GET | `/api/health` | Public | — | Liveness/readiness probe |
| 5 | GET | `/api/surveys` | Token | SURVEY_OWNER | List own surveys |
| 6 | POST | `/api/surveys` | Token | SURVEY_OWNER | Create draft survey with questions |
| 7 | GET | `/api/surveys/:id` | Token | SURVEY_OWNER (owner) | Get own survey detail |
| 8 | PUT | `/api/surveys/:id` | Token | SURVEY_OWNER (owner) | Replace draft metadata and questions |
| 9 | DELETE | `/api/surveys/:id` | Token | SURVEY_OWNER (owner) | Delete a draft survey |
| 10 | PATCH | `/api/surveys/:id/publish` | Token | SURVEY_OWNER (owner) | Publish a valid draft |
| 11 | PATCH | `/api/surveys/:id/close` | Token | SURVEY_OWNER (owner) | Close a published survey |
| 12 | GET | `/api/surveys/:id/summary` | Token | SURVEY_OWNER (owner) | Aggregate results |
| 13 | GET | `/api/surveys/active` | Token | RESPONDENT | List published surveys and submission state |
| 14 | GET | `/api/surveys/:id/form` | Token | RESPONDENT | Get the form for a published survey |
| 15 | POST | `/api/surveys/:id/responses` | Token | RESPONDENT | Submit one response |
| 16 | GET | `/api/surveys/:id/responses/:responseId` | Token | RESPONDENT (own) | Get own submission receipt |

Route registration order: `/api/surveys/active` must be registered before `/api/surveys/:id` so the
literal path is not captured as an id.

### 4.5 Validation approach

- Zod schemas validate body, params and query at the controller boundary.
- Unknown fields are rejected or stripped; the contract uses strict objects.
- Service-level domain validation runs after shape validation.
- Validation errors return field-level details and never echo the submitted password.
- `PUT /api/surveys/:id` replaces the full question set atomically inside a transaction. It is allowed
  only when the survey is `DRAFT`.

---

## 5. Authentication and Authorization

### 5.1 Password handling

- Passwords are hashed with `bcryptjs`, cost factor 10.
- `passwordHash` is never returned by any endpoint.
- Seed passwords are hashed at seed time, never stored as plaintext.
- Login compares the submitted password with the hash using a constant-time bcrypt comparison.

### 5.2 Token lifecycle

1. Login returns a JWT signed with `JWT_SECRET` (HS256), expiring after `JWT_EXPIRES_IN` (default 8h).
2. Payload: `{ sub: userId, role, ver: tokenVersion }`.
3. Every protected request verifies the signature and expiry, loads the user, and compares `ver` with
   the database value.
4. Logout increments `User.tokenVersion`. Every token issued before logout now fails with
   `401 TOKEN_REVOKED`.
5. There are no refresh tokens. After expiry the user logs in again.
6. The client stores the token in `localStorage` for refresh persistence and clears it on 401 or
   logout. This is an accepted trade-off for the course; XSS risk is reduced with a strict CSP and no
   `dangerouslySetInnerHTML`. HttpOnly cookies are recorded as future work.

### 5.3 Role and ownership matrix

| Operation | Unauthenticated | RESPONDENT | SURVEY_OWNER (non-owner) | SURVEY_OWNER (owner) | Respondent (other user's receipt) |
|---|---|---|---|---|---|
| Login | Allowed | Allowed | Allowed | Allowed | Allowed |
| `/auth/me`, `/auth/logout` | 401 | Allowed | Allowed | Allowed | Allowed |
| List/create own surveys | 401 | 403 | Allowed | Allowed | 403 |
| Get/update/delete own draft | 401 | 403 | 403 | Allowed | 403 |
| Publish/close own survey | 401 | 403 | 403 | Allowed | 403 |
| View own summary | 401 | 403 | 403 | Allowed | 403 |
| Browse active surveys | 401 | Allowed | 403 | 403 | Allowed |
| Get published form | 401 | Allowed | 403 | 403 | Allowed |
| Submit response | 401 | Allowed, if eligible and not already submitted | 403 | 403 | Allowed |
| Get own receipt | 401 | Allowed | 403 | 403 | 403 |

Key correction from the previous draft: owners are **not** allowed to open or submit survey forms.
Roles are exclusive.

### 5.4 Authorization rules

- Role guard first: wrong role → `403 FORBIDDEN_ROLE`.
- Ownership check second: wrong owner → `403 FORBIDDEN_OWNERSHIP`.
- For receipt access: if the response belongs to another user → `403 FORBIDDEN_CROSS_RESPONSE_ACCESS`.
- For unknown ids → `404 NOT_FOUND`.
- A forbidden response never includes record data.
- UI hiding is not treated as authorization; tests call the API directly.

---

## 6. Configuration and Delivery Design

### 6.1 Environment variables

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/surveyhub?schema=public"
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/surveyhub_test?schema=public"

# Authentication
JWT_SECRET="replace-with-a-long-random-value"
JWT_EXPIRES_IN="8h"

# Client
CLIENT_ORIGIN="http://localhost:5173"
VITE_API_BASE_URL="http://localhost:4000/api"
```

The example uses the default port 5432. The actual port is whatever the local PostgreSQL instance
uses; it is configured only through `DATABASE_URL` and `DATABASE_URL_TEST`.

Rules:

- `.env` is ignored by Git. `.env.example` contains placeholders only.
- The server validates required variables at startup and refuses to start in production with a
  missing or default `JWT_SECRET`.
- CORS allows only `CLIENT_ORIGIN`.
- `helmet` sets security headers; JSON body size is limited.
- No secret is logged.

### 6.2 Local reproduction

```bash
npm install
cp server/.env.example server/.env
npm run db:migrate
npm run db:seed
npm run dev
```

The client runs on `http://localhost:5173`; the API runs on `http://localhost:4000`.

### 6.3 Docker Compose local environment (Sprint 1)

Sprint 1 Issue [#2](https://github.com/Snnn3/SurveyHub/issues/2) provides a root-level Compose setup with one application service and one PostgreSQL service.

- A multi-stage application image builds the React client and Express/TypeScript server. In the container environment, Express serves `/api` and the built client from the same origin.
- PostgreSQL has a health check. Compose starts the application only after the database reports healthy. A fresh database volume initialization creates both `surveyhub` and the separate `surveyhub_test` database.
- A named database volume preserves data when containers restart or are recreated. Removing the volume is a separate destructive operation and is not part of the normal reset workflow.
- `DATABASE_URL` targets the development database and `DATABASE_URL_TEST` targets the distinct test database. Inside Compose, both use the database service hostname; host-run tests use the published local port. Automated tests must never point at the seeded development database.
- Migration and seed commands are explicit, repeatable commands documented in the root README; application startup does not silently reset or seed persistent data.
- The application exposes public `/api/health` for readiness checks.
- Compose uses placeholder/local values only. Real secrets are kept outside Git.

### 6.4 CI/CD and GCP delivery plan (Lab 5)

- GitHub Actions on pull requests: install, lint, typecheck, migrate the test database, run tests and build.
- A required check blocks merge when it fails.
- The release workflow on `main` builds and pushes an image, runs migrations, and deploys to Cloud Run.
- Cloud Run uses the `PORT` environment variable and `/api/health` probe. Cloud SQL provides production database durability; secrets come from GCP Secret Manager or Cloud Run environment variables, never from the image.
- Deployment records the image tag and commit SHA and is repeatable from the same commit.

---

## 7. Anonymous-Mode Privacy Design (Sprint 2)

This section exists now because the schema must not need a breaking migration later.

### 7.1 Separation

- `Survey.mode = ANONYMOUS`.
- `SurveyResponse.respondentId = NULL`.
- `ResponseClaim` stores `(surveyId, userId)` only. It has no `responseId` column.
- The system knows **that** a user submitted, not **which** response is theirs.
- No IP address, user agent or other request metadata is stored with a response.
- The response id is a random UUID and is not derivable from the user id.

### 7.2 What the owner sees

- Aggregate counts and percentages.
- Rating and integer statistics and date counts.
- Unlinked short- and long-text answers.
- No respondent names, emails or ids.
- Export for an anonymous survey contains aggregates and unlinked text only.

### 7.3 Residual risk

A database administrator could correlate `ResponseClaim.createdAt` with `SurveyResponse.submittedAt`.
To reduce this, the claim row does **not** store a timestamp in Sprint 2; only the unique key is kept.
Even so, an administrator with access to database transaction logs could correlate activity. The
product does not claim cryptographic unlinkability against a privileged database operator. This
limitation is disclosed rather than overclaimed.

---

## 8. Forward-Compatibility Checklist

| Future need | Present in Sprint 1 schema | Later work |
|---|---|---|
| Expanded question types | `QuestionType`; `AnswerOption`; `textValue`; `numberValue`; `dateValue`; `minSelections`, `maxSelections`, `numberMin`, `numberMax` | Sprint 2 validation, authoring UI, response UI and summary for multi-choice, long text, yes/no, Likert, rating, integer and date |
| Anonymous mode | `SurveyMode.ANONYMOUS`, nullable `respondentId`, `ResponseClaim` without response link | Endpoints, privacy tests, UI |
| Eligibility | `SurveyEligibility` table | Management API and UI |
| Scheduled close | `closesAt` | Date picker and server check |
| Export | Existing models and summary service | CSV/JSON serializers |
| Raw response browser | Identified responses already linked | Owner-only endpoints and UI |

---

## 9. Traceability

- Requirements: Part A.
- Feature allocation: Part B.
- Sprint plan: Part D.
- Sprint 1 contracts and tests: Part E.
- Verification evidence: Part F.

No design decision in this document is considered implemented until the corresponding code and tests
exist on the assessed commit.
