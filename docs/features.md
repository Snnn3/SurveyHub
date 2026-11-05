# Part B: Feature Inventory

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
**Course:** CPE 334 Software Engineering, Semester 1/2026
**Deliverable:** Project Deliverable 1 — Part B (10 points)
**Document status:** Baseline v3, aligned with team decisions on 5 November 2026
**Related documents:** Part A (requirements), Part C (system design), Part D (sprint plan), Part E (Sprint 1 contracts)

> Status note: every row in this document is a **plan**. No row is marked VERIFIED until a real test
> run against the submitted commit is recorded in Part F. The previous draft mixed planned tests with
> claimed results; that is corrected here.

---

## 1. Feature Inventory

| Feature | Name | Short description | Linked requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| **F-01** | Authentication and RBAC | Login, logout with token revocation, current-user identity, JWT verification, bcrypt password storage, role guards | FR-01, FR-02; NFR-SEC-01..04 | None | **1** |
| **F-02** | Survey lifecycle and authoring | List, create, read, update and delete draft surveys; ordered questions and options; publish and close; ownership, structure and immutability rules | FR-03..FR-06; BR-04, BR-06, BR-07, BR-09 | F-01 | **1** |
| **F-03** | Response submission and rules | Browse published surveys, load a form, submit one validated response, retrieve the receipt, reject duplicates and invalid states/answers, protect cross-response access | FR-07..FR-09; BR-01, BR-02, BR-03, BR-05, BR-08 | F-01, F-02 | **1** |
| **F-04** | Aggregate summary | Owner-only summary with total responses, answered counts, option counts/percentages and unlinked text answers. Rating averages are added with F-06 in Sprint 2. | FR-10 (Sprint 1 aggregate portion); BR-04, BR-05, BR-11 | F-01..F-03 | **1** |
| **F-05** | Anonymous mode | Survey-level anonymous mode with identity/answer separation and duplicate prevention through claims | FR-11; BR-10; NFR-PRIV-01 | F-01, F-03, F-04 | **2** |
| **F-06** | Advanced question types | Multi-choice with min/max selections and 1–5 rating questions across authoring, response and summary | FR-12 | F-02, F-03, F-04 | **2** |
| **F-07** | Eligibility and scheduled close | Explicit respondent allowlist and a closing date/time evaluated by the server | FR-14, FR-15; BR-02, BR-08 | F-02, F-03 | **2** |
| **F-08** | Rich analytics, response browsing and export | Charts, identified raw-response browser and CSV/JSON export with mode-aware privacy | FR-13, FR-16; BR-11 | F-04, F-06 | **3** |

### 1.1 Feature allocation summary

| Sprint | Features | Checkpoint |
|---|---|---|
| Sprint 1 | F-01, F-02, F-03, F-04 | Deliverable 1 — 8 November 2026 |
| Sprint 2 | F-05, F-06, F-07 | Deliverable 2 — 29 November 2026; Labs 5–6 |
| Sprint 3 | F-08 plus hardening and defect fixes | Final Delivery — 13 December 2026; Lab 7 |

Every feature is allocated to exactly one sprint. Later work is not used to excuse a missing Sprint 1
feature.

---

Part B continues in [traceability.md](traceability.md), which contains the requirements matrix, coverage analysis and verification evidence rules.
