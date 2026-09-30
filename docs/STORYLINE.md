# The Semester Heist — a guided learning path

> A narrative route through **Cybagard University**'s campus portal. Each act
> states an **objective**, the **documented weakness** that gates it (by ID from
> [`VULN_MAP.md`](./VULN_MAP.md)), and the **learning outcome**.
>
> As with the map, this is a **route through the castle** — which door, which
> floor — **not** a lock-picking manual. Techniques and payloads are left to you;
> that discovery *is* the learning. Nothing here should be run against systems
> you do not own or are not authorised to test.

## The premise

You are an outsider who found the university's portal on the open internet.
Your long-term goal: go from **anonymous visitor** to **campus superadmin**,
touching every part of the university on the way — records, library, faculty
tools, and campus security. You cannot skip floors: each act unlocks the next.

Recommended demo starting point: `student1` / `student1`.

---

## Act 0 — Case the campus (Recon)

**Objective:** understand the attack surface before touching anything sensitive.

**Gated by:** `CFG-3` (`/status`), `CFG-4` (`/debug`), the exposed API reference
at `/apidoc`, and `API9` inventory drift — the `/api/v0` and undocumented
operational routes (`BAC-6`).

**Outcome:** you learn to inventory an API, spot a *shadow* (undocumented,
legacy) surface next to the published one, and recognise that operational
endpoints often leak more than the "real" API. Note what `/status` reveals
about how tokens and sessions are secured — you will need it later.

---

## Act 1 — Get a foothold (Authentication)

**Objective:** obtain an authenticated student session.

**Gated by:** one of the login weaknesses — `INJ-1` (student login),
`AUT-1` (no rate limiting anywhere), or simply the weak seeded credentials
(`CRY-1`, `CRY-2`).

**Outcome:** you experience more than one *class* of authentication failure on
the same door: a logic/injection flaw, an absence of anti-automation controls,
and weak credential storage. Contrast the injectable login with the
parameterised `library/list/book/:id` reference to see what "done right" looks
like.

---

## Act 2 — Walk the halls (Horizontal access)

**Objective:** read data belonging to *other* students.

**Gated by:** `BAC-1` (student detail by id), `BAC-2` (transcript by id),
reinforced by `BOP-2` (records returned whole, secrets included).

**Outcome:** you see Broken Object Level Authorization first-hand: the server
trusts an object id from the client and never asks "is this *yours*?". You also
see why *excessive data exposure* turns a read bug into a credential-harvesting
bug.

---

## Act 3 — Get promoted (Vertical escalation)

**Objective:** turn your student account into something more privileged.

**Gated by:** `BOP-1` (mass assignment on `PATCH /api/v1/me` — `role` and
friends are writable).

**Outcome:** you learn Broken Object *Property* Level Authorization: the object
was yours, but individual *properties* (like `role`) should never have been
writable. One request changes who you are to the rest of the system.

---

## Act 4 — Faculty powers (Function-level access)

**Objective:** use functions that were meant for faculty/staff only.

**Gated by:** `BAC-3` (grade change), `BAC-4` (enroll), and the design gaps
`DSN-1`/`DSN-3` (no guardrails on privileged flows).

**Outcome:** Broken Function Level Authorization — reaching an endpoint the UI
would never show a student. You feel the difference between *object* authz
(Act 2/3) and *function* authz (here).

---

## Act 5 — Into campus security (NoSQL + crypto)

**Objective:** breach the campus security store and forge trust.

**Gated by:** `INJ-6` (NoSQL operator injection on the campus login) and
`CRY-4` (the hand-rolled campus token — its verifier trusts the token's own
declared algorithm and leans on a weak shared secret; recall what `/status`
told you in Act 0). `BAC-5` then lets a merely-*present* token reach an
"admin-only" roster.

**Outcome:** you connect two different trust failures — a datastore that treats
input as query structure, and a token verifier that treats attacker-controlled
metadata as authority — and see how each independently defeats a login.

---

## Act 6 — Own the campus & go quiet (SSRF + logging)

**Objective:** reach internal-only surfaces and understand why nobody noticed.

**Gated by:** `SSR-1` (avatar/URL fetcher reaches inward), supported by
`UAP-1` (a trusted upstream feed), while `LOG-1`/`LOG-2` explain the silence —
sensitive data lands in cleartext logs, and no privileged action (grade change,
role change, roster read) is audited or alerted.

**Outcome:** you tie the offensive path to the defensive gap: the same actions
that gave you the campus also went unmonitored. This is where a learner is
asked to *flip* perspective and describe the detection that should have fired.

---

# Named mini-chains

Short, self-contained combinations for focused practice. Each names the
**documented weaknesses** it strings together — not the steps.

### Chain A — "Grade Inflation"
`INJ-1` / foothold → `BAC-2` (find the transcript) → `BOP-1` (promote self) →
`BAC-3` (write the grade).
*Teaches:* how a low-severity read chains into a high-severity write once
object- and function-level authz are both missing.

### Chain B — "The Ghost Librarian"
`CRY-4` (forge/adjust a campus token) → `BAC-5` (reach the admin roster) →
`BOP-2` (harvest the secrets it returns) → `DSN-2` (pull it all, unthrottled).
*Teaches:* identity forgery + function-level authz + excessive exposure +
missing resource limits, as one exfiltration story.

### Chain C — "Rogue Autograder"
`INT-1` (upload a file with no integrity checks, under a name you choose) →
served back from `/uploads` → `CMP-1`/`XSS-1` (announcements rendered by an
outdated markdown component).
*Teaches:* software & data integrity failures, and how an unsanitised render
path plus an outdated component compound.

### Chain D — "Front-Desk Bypass"
`INJ-6` (NoSQL injection on campus login) → campus-root identity →
`CFG-3` (`/status` hands you the signing secrets) → back to Chain B.
*Teaches:* how one datastore trust failure cascades into full secret disclosure.

---

## For instructors

- Every checkpoint maps to a `VULN_MAP.md` ID, so you can grade on *which*
  weakness a learner identified and *where*, without publishing payloads.
- Ask learners to finish each act with a **defensive** write-up: the control
  that should have stopped them (allow-list, ownership check, parameterisation,
  signed/verified token, egress policy, audit event).
- The safe-by-contrast endpoints (parameterised `book/:id`) are useful as the
  "what good looks like" anchor for code-review exercises.
