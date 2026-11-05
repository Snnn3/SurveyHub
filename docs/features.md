# Part B: Feature Inventory

**System:** SurveyHub — Review, Feedback, and Survey System (Theme 10)
**Course:** CPE 334 Software Engineering, Semester 1/2026
**Deliverable:** Project Deliverable 1 — Part B (10 points)
**Document status:** Baseline v4, aligned with team decisions on 5 November 2026
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
| **F-04** | Aggregate summary | Owner-only summary with total responses, answered counts, option counts/percentages and unlinked short text. F-06 defines additional type-aware summary values in Sprint 2. | FR-10 (Sprint 1 base; Sprint 2 type extensions); BR-04, BR-05, BR-11 | F-01..F-03 | **1** |
| **F-05** | Anonymous mode | Survey-level anonymous mode with identity/answer separation and duplicate prevention through claims | FR-11; BR-10; NFR-PRIV-01 | F-01, F-03, F-04 | **2** |
| **F-06** ([Issue #9](https://github.com/Snnn3/SurveyHub/issues/9)) | Expanded question types | Multi-choice, long text, yes/no, five-point Likert, 1–5 rating, bounded integer and date questions across authoring, response and summary | FR-12 | F-02, F-03, F-04 | **2** |
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

### 1.2 Question type inventory

| Question type | Sprint | Answer representation and rule |
|---|---:|---|
| Single-choice | 1 | Select exactly one question option. |
| Short text | 1 | Trimmed text, up to 2,000 characters. |
| Multi-choice | 2 | Select question options within the configured minimum and maximum. |
| Long text | 2 | Trimmed text, up to 10,000 characters. |
| Yes/no | 2 | Select exactly one fixed option: `Yes` or `No`. |
| Likert | 2 | Select exactly one of five ordered labels: Strongly disagree, Disagree, Neither agree nor disagree, Agree, Strongly agree. |
| Rating | 2 | Integer from 1 through 5. |
| Integer | 2 | Whole-number answer within optional author-defined minimum and maximum. |
| Date | 2 | Calendar date, stored without a time component or time zone. |

The catalog has nine answer types. A dropdown is a presentation control for choice options, not a
separate answer type. File upload and matrix/grid questions remain out of scope.

### 1.3 F-06 acceptance criteria (Sprint 2)

| AC | Observable outcome |
|---|---|
| **AC-F06-01** | Each Sprint 2 type can be authored in a draft, rendered to a respondent, submitted and persisted using the correct answer representation. |
| **AC-F06-02** | Multi-choice accepts only options belonging to the question and enforces its configured minimum and maximum selections. |
| **AC-F06-03** | Long text accepts at most 10,000 characters; required values cannot be blank after trimming. |
| **AC-F06-04** | Yes/no accepts exactly one of the fixed `Yes` and `No` options. |
| **AC-F06-05** | Likert accepts exactly one of the five ordered labels defined in §1.2. |
| **AC-F06-06** | Rating accepts only integer values from 1 through 5. |
| **AC-F06-07** | Integer answers respect configured minimum and maximum bounds, when present. |
| **AC-F06-08** | Date answers accept a valid `YYYY-MM-DD` calendar date and persist without a time or time-zone shift. |
| **AC-F06-09** | The owner summary reports option counts/percentages, unlinked short- and long-text answers, rating/integer count, average, minimum and maximum, and date counts; it contains no respondent identity. |

---

Part B continues in [traceability.md](traceability.md), which contains the requirements matrix, coverage analysis and verification evidence rules.
