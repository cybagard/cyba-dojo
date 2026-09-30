# Cyba Dojo — Vulnerability Map

> **Cybagard University** campus portal — an intentionally vulnerable
> learning environment.
>
> This document records **where** each planted weakness lives and **what class**
> it belongs to. It deliberately does **not** contain exploitation steps,
> payloads, or "how to pop it" recipes — working out the technique is the
> exercise. Treat this as a study map, not a walkthrough.

## How to read this map

Each entry lists:

| Field | Meaning |
|---|---|
| **ID** | Stable reference used by `STORYLINE.md` and `OWASP_COVERAGE.md`. |
| **Domain** | The university feature area (and its datastore). |
| **Location** | Source file where the weakness is rooted → the HTTP route that reaches it. |
| **Class** | The weakness category. |
| **Gives** | What an attacker gains — the *stakes*, not the method. |

Datastore ↔ domain map:

| Domain | Datastore | Base route |
|---|---|---|
| Library (book lending) | PostgreSQL | `/api/v1/library` |
| Lending (staff login) | MySQL | `/api/v1/lending` |
| Campus Security (superadmins) | MongoDB | `/api/v1/campus` |
| Students (identity + profile) | SQLite | `/api/v1/students`, `/api/v1/me` |
| Registrar (transcripts/grades) | PostgreSQL | `/api/v1/registrar` |
| Coursework (materials/announcements) | SQLite + filesystem | `/api/v1/courses` |
| Campus SSO (tokens) | — (stateless) | `/api/v1/sso` |
| Legacy / Operations | mixed | `/api/v0`, `/status`, `/debug` |

Demo identities (also seeded into the stores):

| Who | Where | Username | Notes |
|---|---|---|---|
| Student | SQLite `students` | `student1`, `student2` | password = username |
| Faculty | SQLite `students` | `prof_lang` | role `faculty` |
| Lending staff | MySQL `login` | `admin`, `librarian` | plaintext passwords |
| Campus superadmin | MongoDB | `Superadmin`, `Campusadmin` | clearance `campus-root` / `campus-ops` |
| Local admins | SQLite `admins` | `admin1`, `admin2` | md5 passwords |

---

## A03 — Injection

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| INJ-1 | Students | `src/db/sqlite.js` → `authenticate()` → `POST /api/v1/students/login` | SQL injection (string-concatenated username, single-quoted) | Auth bypass / data read from `students` |
| INJ-2 | Students | `src/db/sqlite.js` → `listById()` → `GET /api/v1/students/list/:id` | SQL injection (concatenated numeric id) | Arbitrary read from `students` |
| INJ-3 | Lending | `src/db/mysql.js` → `findByUsername()` → `POST /api/v1/lending/login` | SQL injection **+ stacked queries** (`multipleStatements: true`) | Auth bypass / multi-statement execution on `logins` |
| INJ-4 | Library | `src/db/postgres.js` → `listByStudentId()`, filtered in `src/routes/library.js` → `GET /api/v1/library/list/student/:id` | SQL injection behind a **bypassable** whitespace filter | Read from `books` (and beyond) |
| INJ-5 | Registrar | `src/db/postgres.js` → `transcriptByStudentId()` → `GET /api/v1/registrar/transcript/:studentId` | SQL injection (concatenated id) | Read from `transcripts` (and beyond) |
| INJ-6 | Campus Security | `src/routes/campus.js` + `src/db/mongo.js` → `authenticate()` → `POST /api/v1/campus/security/login` | NoSQL operator injection (query document built from request body) | Auth bypass on superadmin store |

> **Safe-by-contrast reference:** `GET /api/v1/library/list/book/:id`
> (`src/db/postgres.js` → `listByBookId()`) uses a **bound parameter** (`$1`).
> Compare it against INJ-4 to see the difference a parameter makes.

---

## A01 — Broken Access Control · API1 (BOLA) · API5 (BFLA)

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| BAC-1 | Students | `src/routes/students.js` → `GET /api/v1/students/list/:id` | BOLA — object id trusted from the client | Any student's full record |
| BAC-2 | Registrar | `src/routes/registrar.js` → `GET /api/v1/registrar/transcript/:studentId` | BOLA — no ownership check | Any student's transcript |
| BAC-3 | Registrar | `src/routes/registrar.js` → `POST /api/v1/registrar/grade` | BFLA — faculty function, no role check | Write grades as any session |
| BAC-4 | Registrar | `src/routes/registrar.js` → `POST /api/v1/registrar/enroll` | BFLA / horizontal — enroll on behalf of any id | Alter enrollment records |
| BAC-5 | Campus SSO | `src/routes/sso.js` → `GET /api/v1/sso/admin/roster` | BFLA — "admin" function gated on token *presence*, not role | Full roster incl. secrets |
| BAC-6 | Legacy | `src/routes/legacy.js` → `GET /api/v0/students/:id` | Missing authentication on a legacy route | Any student record, unauthenticated |

---

## API3 — Broken Object Property Level Authorization (BOPLA)

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| BOP-1 | Profile | `src/routes/me.js` → `PATCH /api/v1/me` + `src/db/sqlite.js` → `updateProfile()` | Mass assignment — no writable-field allow-list (`role`, `gpa`, `api_key` writable) | Self privilege escalation |
| BOP-2 | Profile / Students / Campus | `GET /api/v1/me`, `GET /api/v1/students/list/:id`, `POST /api/v1/campus/security/login`, `GET /api/v1/sso/admin/roster`, `GET /api/v0/students/:id` | Excessive data exposure — records returned whole (password hash, `api_key`, clearance) | Credential / secret harvesting |

---

## A02 — Cryptographic Failures · A07 / API2 — Authentication Failures

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| CRY-1 | Lending | `src/db/mysql.js` (seed + compare in `src/routes/lending.js`) | Plaintext password storage & comparison | Trivial credential compromise |
| CRY-2 | Students | `src/db/sqlite.js` → `md5()` | Unsalted MD5 password hashing | Offline cracking / rainbow tables |
| CRY-3 | Session | `src/config.js` (`sessionSecret`) used in `src/app.js` | Hardcoded, low-entropy session secret | Session forgery |
| CRY-4 | Campus SSO | `src/services/tokens.js` → `verifyToken()` | Hand-rolled token: accepts `alg: "none"`; weak shared secret (`campus`) | Token forgery / role elevation |
| AUT-1 | All logins | `students/login`, `lending/login`, `campus/security/login`, `sso/token` | No rate limiting, lockout, or backoff | Unbounded credential guessing |

---

## A05 · API8 — Security Misconfiguration

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| CFG-1 | App | `src/app.js` → `cors({ origin: true, credentials: true })` | Reflective CORS with credentials | Cross-origin session abuse |
| CFG-2 | App | `src/app.js` → error handler | Verbose errors: `message` + `stack` returned to client | Internal detail disclosure |
| CFG-3 | Operations | `src/routes/legacy.js` → `GET /status` | Runtime + full config (incl. `sessionSecret`, `campusTokenSecret`, DB creds) disclosed | Secret disclosure |
| CFG-4 | Operations | `src/routes/legacy.js` → `GET /debug` | Request headers, session, cookies, and full `process.env` echoed | Secret / state disclosure |
| CFG-5 | Infra | `compose.datastores.yaml` / `compose.override.yaml` / `config/mysql/my.cnf` | Postgres `trust` auth, MySQL `root/root` with empty `secure-file-priv` (file read/write), Mongo unauthenticated, debug port `9229` exposed | Weak service posture; MySQL file primitives amplify INJ-3 |

---

## A06 — Vulnerable & Outdated Components

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| CMP-1 | Coursework | `package.json` → `marked@0.3.6` (used in `src/routes/courses.js`) | Deliberately pinned outdated component | Known-advisory surface (also feeds XSS-1) |

> The rest of the stack is intentionally kept current so this category is
> represented by exactly one clearly-labelled pin. See `OWASP_COVERAGE.md`.

---

## A10 · API7 — SSRF · API10 — Unsafe Consumption of APIs

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| SSR-1 | Profile | `src/routes/me.js` → `POST /api/v1/me/avatar/import` + `src/services/fetcher.js` → `fetchUrl()` | SSRF — server fetches a user-supplied URL, returns a body preview | Reach internal-only surfaces |
| UAP-1 | Profile | `src/routes/me.js` → `POST /api/v1/me/timetable/import` + `src/services/fetcher.js` → `importTimetable()` | Unsafe consumption — upstream response trusted & reflected without validation | Poisoned upstream → tainted data |

---

## A08 — Software & Data Integrity Failures

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| INT-1 | Coursework | `src/routes/courses.js` → `POST /api/v1/courses/materials` (multer `diskStorage`) | Upload with no type/size checks, stored under client-supplied filename; supplied `checksum` stored but **never verified** | Untrusted files served back from `/uploads` |

---

## XSS (client-side injection)

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| XSS-1 | Coursework | `src/routes/courses.js` (announcements rendered via `marked`) + `public/portal/app.js` → `loadAnnouncements()` (`innerHTML`) | Stored XSS — user markdown rendered to HTML and injected without sanitisation | Script execution in a viewer's session |

---

## A09 — Security Logging & Monitoring Failures

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| LOG-1 | All datastores | `src/db/*.js` → `console.log('executed query', …)` | Sensitive data (incl. injected input) logged in cleartext | Secrets leak into logs |
| LOG-2 | Registrar / Profile / SSO | grade change, role change, token issue, roster read | No audit trail or alerting on privileged actions | Undetected abuse |

---

## A04 — Insecure Design · API4 · API6

| ID | Domain | Location | Class | Gives |
|---|---|---|---|---|
| DSN-1 | Registrar | `POST /api/v1/registrar/enroll`, `POST /api/v1/registrar/grade` | Insecure design — privileged flows have no business-rule guardrails | Trust-by-design abuse |
| DSN-2 | Multiple | `GET /api/v1/students/list`, `GET /api/v1/sso/admin/roster`, `POST /api/v1/courses/materials` | API4 — no pagination, quotas, or resource limits | Unrestricted resource consumption |
| DSN-3 | Registrar / Coursework | enroll & announcement flows | API6 — sensitive business flows open to automation | Bulk/automated abuse |

---

### Category coverage at a glance

Both the **OWASP Top 10 (2021)** and the **OWASP API Security Top 10 (2023)**
are represented. The full checklist, with the IDs above mapped to each item,
is in [`OWASP_COVERAGE.md`](./OWASP_COVERAGE.md). The guided learning path that
chains these together is in [`STORYLINE.md`](./STORYLINE.md).
