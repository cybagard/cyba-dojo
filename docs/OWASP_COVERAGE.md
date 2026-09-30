# OWASP Coverage Matrix

Maps each **OWASP Top 10 (2021)** and **OWASP API Security Top 10 (2023)** item
to the planted weaknesses in this dojo. IDs reference
[`VULN_MAP.md`](./VULN_MAP.md); the guided path is in
[`STORYLINE.md`](./STORYLINE.md).

Legend: ✅ represented · ➖ represented indirectly / by design choice.

## OWASP Top 10 — 2021

| # | Category | Status | Where (VULN_MAP IDs) |
|---|---|:---:|---|
| A01 | Broken Access Control | ✅ | BAC-1…BAC-6, BOP-1 |
| A02 | Cryptographic Failures | ✅ | CRY-1, CRY-2, CRY-3, CRY-4 |
| A03 | Injection | ✅ | INJ-1…INJ-6, XSS-1 |
| A04 | Insecure Design | ✅ | DSN-1, DSN-2, DSN-3, AUT-1 |
| A05 | Security Misconfiguration | ✅ | CFG-1…CFG-5 |
| A06 | Vulnerable & Outdated Components | ✅ | CMP-1 *(single deliberate pin — see note)* |
| A07 | Identification & Authentication Failures | ✅ | AUT-1, CRY-3, CRY-4, CRY-1, CRY-2 |
| A08 | Software & Data Integrity Failures | ✅ | INT-1 |
| A09 | Security Logging & Monitoring Failures | ✅ | LOG-1, LOG-2 |
| A10 | Server-Side Request Forgery (SSRF) | ✅ | SSR-1 |

## OWASP API Security Top 10 — 2023

| # | Category | Status | Where (VULN_MAP IDs) |
|---|---|:---:|---|
| API1 | Broken Object Level Authorization | ✅ | BAC-1, BAC-2, BAC-6 |
| API2 | Broken Authentication | ✅ | AUT-1, CRY-3, CRY-4 |
| API3 | Broken Object Property Level Authorization | ✅ | BOP-1 (mass assignment), BOP-2 (excessive exposure) |
| API4 | Unrestricted Resource Consumption | ✅ | DSN-2 |
| API5 | Broken Function Level Authorization | ✅ | BAC-3, BAC-4, BAC-5 |
| API6 | Unrestricted Access to Sensitive Business Flows | ✅ | DSN-1, DSN-3 |
| API7 | Server-Side Request Forgery | ✅ | SSR-1 |
| API8 | Security Misconfiguration | ✅ | CFG-1…CFG-5 |
| API9 | Improper Inventory Management | ✅ | BAC-6 (`/api/v0`), CFG-3 (`/status`), CFG-4 (`/debug`) |
| API10 | Unsafe Consumption of APIs | ✅ | UAP-1 |

## Notes

- **A06 by design.** To keep the stack modern (Node 22 / Express 5 / current
  drivers), exactly one component — `marked@0.3.6` — is pinned outdated on
  purpose and clearly labelled (`CMP-1`). It also powers the stored-XSS render
  path (`XSS-1`), so it earns its place twice. Everything else is intentionally
  current, so "outdated components" is a single, obvious teaching pin rather
  than a stack-wide liability.
- **Overlap is intentional.** Several weaknesses satisfy both a Web and an API
  category (e.g. misconfiguration, SSRF, auth). They are listed under each so
  learners can approach from either framework.
- **Safe-by-contrast anchors.** `GET /api/v1/library/list/book/:id`
  (parameterised query) is included as a "what good looks like" reference for
  code-review exercises — see `VULN_MAP.md`.

## Validation status

Every weakness id above is exercised by the automated E2E suite (`npm test`),
which boots all four datastores under Docker Compose and asserts each one's
documented behaviour at runtime:

- **API walkthrough** (`test/api.e2e.test.js`) — the seven storyline acts plus a
  dedicated test per remaining id (INJ-2…INJ-5 injections incl. the filter
  bypass and a UNION login forgery, BAC-4, CRY-1/CRY-2/CRY-3, AUT-1,
  CFG-1/CFG-2/CFG-5, CMP-1, DSN-1/DSN-2/DSN-3, LOG-2), and the safe-by-contrast
  parameterised endpoint.
- **UI mission suite** (`test/ui.e2e.spec.js`) — the self-paced Mission Console
  flow (acts 0–6 and the Defend step), plus two real vulnerabilities driven through the browser (mass assignment
  and stored-XSS execution).

The intended offensive technique for each is still left as the exercise; the
tests prove the weakness is present and reachable, not how to weaponise it.
