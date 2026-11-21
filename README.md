# SurveyHub — Review, Feedback, and Survey System

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026, KMUTT)  
**Theme 10:** Review, Feedback, and Survey System  
**Baseline Release:** Sprint 1 — Project Deliverable 1  

SurveyHub is a full-stack survey management system built with React, Express, TypeScript, Prisma ORM, and PostgreSQL. It enables organizations to author and manage surveys, gather validated responses with strict duplicate prevention and privacy guards, and view aggregate results.

---

## Tech Stack & Architecture

- **Frontend (`client/`):** React 18, Vite, TypeScript, Tailwind CSS, React Router, Axios
- **Backend (`server/`):** Node.js 20 LTS, Express, TypeScript, Prisma ORM, bcryptjs, jsonwebtoken, Zod, Helmet, CORS
- **Database:** PostgreSQL 16 (with dedicated development and isolated test databases)
- **Containerization:** Multi-stage Dockerfile serving client and API on the same origin via Docker Compose

---

## Quickstart & Clean-Checkout Setup

### Prerequisites

| Tool | Version | Verification Command |
|---|---|---|
| **Docker Engine / Desktop** | Compose v2.30+ | `docker --version` && `docker compose version` |
| **Node.js** | 20 LTS or later | `node --version` |
| **npm** | Compatible with Node 20 | `npm --version` |

Playwright E2E tests use the locally installed Google Chrome Stable browser (`channel: 'chrome'`).

---

### Option A: Docker Compose Path (Recommended)

This reproduces the single-origin container deployment with persistent PostgreSQL storage:

```bash
# 1. Clone the repository and enter the directory
git clone https://github.com/Snnn3/SurveyHub.git
cd SurveyHub

# 2. Configure environment variables (PowerShell: Copy-Item .env.example .env)
cp .env.example .env
# Create ignored local passwords without printing them:
node -e "const fs=require('fs'),c=require('crypto');let e=fs.readFileSync('.env','utf8');const db=c.randomBytes(32).toString('hex'),jwt=c.randomBytes(32).toString('hex'),demo=c.randomBytes(24).toString('hex');for(const [p,v] of [['replace-with-a-local-database-password',db],['replace-with-a-long-random-value',jwt],['replace-with-a-local-demo-password',demo]])e=e.split(p).join(v);fs.writeFileSync('.env',e);fs.writeFileSync('.env.seed','DEMO_USER_PASSWORD='+demo+String.fromCharCode(10));"

# 3. Build the multi-stage application image and launch PostgreSQL
docker compose build app
docker compose up -d db

# 4. Apply database migrations and load reproducible synthetic seed data
docker compose run --rm app npm run db:migrate:deploy
docker compose run --rm --env-from-file .env.seed app npm run db:seed

# 5. Start the application container
docker compose up -d app

# 6. Verify service health and container status
docker compose ps
curl http://localhost:4000/api/health
```

- **Application Web UI & API:** Open [http://localhost:4000](http://localhost:4000) in your browser.
- **Health Check Probe:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

### Option B: Local Host Development Path

To run the client and server locally with hot-reloading:

```bash
# 1. Install root monorepo dependencies
npm install

# 2. Configure environment variables from template; set real local database credentials first
cp .env.example .env
# Replace the example database password in POSTGRES_PASSWORD and both URLs, and set DEMO_USER_PASSWORD.
cp .env server/.env

# 3. Ensure PostgreSQL is running (e.g. via Docker: docker compose up -d db)
# 4. Run database migrations and seed data
npm run db:migrate
npm run db:seed

# 5. Start development servers concurrently
npm run dev
```

- **Frontend (Vite Dev Server):** [http://localhost:5173](http://localhost:5173) (Proxies `/api` to port 4000)
- **Backend (Express API Server):** [http://localhost:4000](http://localhost:4000)

---

## Testing & Quality Verification

Automated test suites use an isolated test database (`surveyhub_test`) so tests never mutate seeded development data:

```bash
# Run all server integration and health tests
npm test

# Run a specific test suite
npm test --prefix server -- tests/health.test.ts

# Run the production-build E2E journeys (resets and seeds only surveyhub_test)
npm run test:e2e

# Measure 50 sequential GET /api/surveys/:id/form requests; writes docs/evidence/nfr-perf-01.json
npm run bench:read --prefix server

# Typecheck both frontend and backend
npm run typecheck

# Build both frontend and backend for production
npm run build
```

---

## Seeded Synthetic Demo Accounts

The seed creates the same four synthetic accounts with the operator supplied `DEMO_USER_PASSWORD` (bcrypt cost factor 10). The value is read from the ignored root `.env` for host seeding, or passed through the one-off `.env.seed` file for Compose seeding. The app service never receives this seed-only password. Production seeds reject the test password and weak values.

| Role | Email | Password source | Purpose in Verification |
|---|---|---|---|
| `SURVEY_OWNER` | `owner1@survey.local` | `DEMO_USER_PASSWORD` | Primary owner; authors, publishes surveys and inspects aggregate summaries |
| `SURVEY_OWNER` | `owner2@survey.local` | `DEMO_USER_PASSWORD` | Secondary owner; used for ownership isolation verification |
| `RESPONDENT` | `resp1@survey.local` | `DEMO_USER_PASSWORD` | Primary respondent; takes surveys, tests duplicate submission guard |
| `RESPONDENT` | `resp2@survey.local` | `DEMO_USER_PASSWORD` | Secondary respondent; tests cross-response privacy restrictions |

See [Lab 5 deployment and environment configuration](docs/labs/lab-05/deployment.md) for the variable matrix, Cloud Run settings, and persistent Compose verification.

---

## Repository Structure

```text
.
├── .env.example               # Root environment variable template
├── .gitignore                 # Monorepo git ignore rules
├── AGENTS.md                  # Workflow, branching & review rules
├── .github/workflows/         # Required CI gate and main-only Cloud Run deploy
│   ├── ci-docker.yml          # Isolated PostgreSQL tests and Docker build
│   └── deploy.yml              # WIF-authenticated release workflow
├── deploy/                    # Lab 5 Cloud Run helpers and smoke checks
│   ├── deploy.sh              # Manual entry point (dry run by default)
│   ├── release.sh             # Migration and digest-pinned service update
│   ├── validate-resources.sh  # Assigned project and team-prefix guard
│   ├── smoke_test.py          # Read-only deployed-service checks
│   └── tests/                 # Offline deploy safety checks
├── Dockerfile                 # Multi-stage production container build
├── README.md                  # Reproduction instructions & project guide
├── docker-compose.yml         # Containerized app & persistent PostgreSQL db
├── package.json               # Root monorepo workspace scripts
├── docs/                      # Engineering baseline specifications (Parts A–F)
│   ├── README.md              # Deliverable 1 navigation table
│   ├── srs.md                 # Part A: Software Requirements Specification
│   ├── features.md            # Part B: Feature Inventory
│   ├── traceability.md        # Part B: Requirements Traceability Matrix
│   ├── system-sds.md          # Part C: System-Level Software Design Specification
│   ├── verification.md        # Part F: Verification and execution evidence
│   └── sprints/
│       ├── plan.md            # Part D: Three-Sprint Plan & Risk Management
│       └── sprint-1/          # Part E: Feature Engineering Contracts (F-01..F-04)
├── client/                    # Frontend React 18 application (Vite + Tailwind)
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx            # Main layout & health probe widget
│   │   └── main.tsx
└── server/                    # Backend Node.js / Express API application
    ├── package.json
    ├── prisma/
    │   ├── schema.prisma      # PostgreSQL schema & constraints
    │   ├── migrations/        # Versioned SQL migration history
    │   └── seed.ts            # Idempotent synthetic seed data
    ├── src/
    │   ├── app.ts             # Express bootstrap & static frontend serving
    │   ├── server.ts          # Port listening entrypoint
    │   ├── controllers/       # API controllers (health, etc.)
    │   ├── middleware/        # Error handling & security middleware
    │   └── utils/             # Prisma singleton and error envelope utilities
    └── tests/                 # Automated test suites
        ├── setup.ts           # Test DB configuration
        └── health.test.ts     # Health probe & route error tests
```
