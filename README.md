# Cyba Dojo

## What is it?

It's an intentionally vulnerable web application — a whole fake university campus
portal — that you break into on purpose, one guided step at a time, to learn web and
API security.

## Why would I want to do that?

Most security tutorials hand you one bug in isolation: here's a SQL injection, here's a
cross-site scripting, now move along. Real systems aren't so tidy. Bugs hide inside
ordinary features, and one small mistake becomes the foothold for the next.

Cyba Dojo gives you a complete, believable campus app — students, a library, a
registrar, coursework, campus security, single sign-on — where every feature hides a
weakness that grew out of a plausible-but-wrong design decision, the kind you actually
meet in the wild. Better yet, it doesn't just dump you into it. A built-in storyline
walks you from "anonymous visitor" all the way to "campus superadmin," so you're never
staring at a blank page wondering what to try. Along the way you cover the whole OWASP
Top 10 (2021) and OWASP API Security Top 10 (2023).

## Is it safe to run?

Sure — as long as you keep it to yourself. It is deliberately full of holes, so treat it
like the toxic waste it is:

- Run it locally, on a machine and network you control.
- Never expose it to the public internet or an untrusted network.
- Only practice these techniques against systems you own or are explicitly authorised to
  test.

## How do I run it?

You'll need [Docker](https://docs.docker.com/get-docker/) with Compose. Then bring up the
whole campus — the app plus PostgreSQL, MySQL and MongoDB — in one command:

```shell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Now open http://localhost:3000/ and you're on the portal. The API lives under
`/api/v1`, and the auto-generated API reference is at `/apidoc`.

Don't want to install Docker just to look around? The student-facing parts run on an
in-memory SQLite database with no containers at all:

```shell
npm install
npm run dev
```

The Students, Profile, Coursework and SSO areas work standalone that way; the Library,
Lending, Registrar and Campus Security areas need their databases, so use the Docker
command above for the full storyline.

## Okay, I'm in. Now what?

The landing page is the start of the story — Act 0, reconnaissance. Poke at the recon
links and notice how chatty the app is.

Then sign in. The student account is already filled in for you (`student1` / `student1`),
so just click the button. That's your foothold, and you're now looking at the Mission
Console: your progress, the current act, a "look for" hint, and a button that drops you
on the exact screen you need. Finish an act and the next one unlocks.

The path runs like this:

0. **Case the campus** — reconnaissance and information disclosure.
1. **Get a foothold** — authentication weaknesses.
2. **Read the class** — broken object-level authorization (a.k.a. BOLA / IDOR).
3. **Change who you are** — mass assignment.
4. **Rewrite the record** — broken function-level authorization.
5. **Breach campus security** — NoSQL injection and broken cryptography.
6. **Reach inside and go quiet** — server-side request forgery and missing logging.

Each act ends by flipping the question around: *what control should have stopped you?*
That defender's answer is where the learning actually sticks.

## How does it work under the hood?

It's a modern Node.js 22 / Express 5 app, written in ES modules, with a small
self-contained portal frontend that needs no build step. Each campus domain is backed by
a different datastore, so you get to practice across four database technologies:

- **Library** (book lending) — PostgreSQL — `/api/v1/library`
- **Lending** (staff login) — MySQL — `/api/v1/lending`
- **Campus Security** (superadmins) — MongoDB — `/api/v1/campus`
- **Students** (identity and profiles) — SQLite — `/api/v1/students`, `/api/v1/me`
- **Registrar** (transcripts and grades) — PostgreSQL — `/api/v1/registrar`
- **Coursework** (materials and announcements) — SQLite plus files — `/api/v1/courses`
- **Campus SSO** (tokens) — `/api/v1/sso`
- **Legacy / Operations** (old and operational endpoints) — `/api/v0`, `/status`, `/debug`

The whole stack is kept deliberately current, with exactly one exception: the `marked`
package is pinned to an old, known-vulnerable version on purpose, to represent
"vulnerable and outdated components." Your dependency scanner will flag it — that's the
point, not a mistake.

## How hard is it?

Beginner-friendly, ramping to intermediate — easy-to-medium in CTF terms. The first few
acts need nothing but a browser and are there to build confidence with quick wins. The
last couple ask a bit more of you: you'll reach for `curl` or your browser's dev tools
and think harder about NoSQL operators, token structure and internal targets. The Mission
Console keeps a hint one click away the whole time, so you're guided, not stranded.

## Where's the documentation?

Three files under `docs/`, plus the live API reference:

- `docs/VULN_MAP.md` — where each weakness lives and what class it is. It's a study map,
  deliberately without exploit recipes; working out the technique is the exercise.
- `docs/STORYLINE.md` — the full guided path, *The Semester Heist*, plus a few named
  mini-chains for focused practice.
- `docs/OWASP_COVERAGE.md` — both OWASP Top 10 lists mapped to the planted weaknesses.

The seeded demo accounts (starting with `student1` / `student1`) are listed in full in
`docs/VULN_MAP.md`.

## How do I know the vulnerabilities actually work?

Because there's an end-to-end suite that proves it. It boots all four databases, walks
the whole storyline, and asserts every weakness in the map behaves exactly as written —
so the docs can't quietly drift away from the code.

```shell
# one-time: fetch the Playwright browser (skip if you already have it)
npx playwright install chromium

# full run: brings up the datastore stack, runs both suites, tears it down
npm test
```

The API walkthrough (`npm run test:api`) checks every weakness against the real backend;
the UI suite (`npm run test:ui`) drives the Mission Console and runs real vulnerabilities
through an actual browser, including a stored cross-site scripting that genuinely
executes. Both need the datastores from `docker-compose.test.yml`.

## Can I use this to teach a class or run a CTF?

Please do. Every weakness has a stable id in `docs/VULN_MAP.md`, a place in the storyline,
and an automated test proving it's live — so you can grade on *which* weakness a learner
found and *where*, without ever publishing a payload.

## Want an attacker box or a WAF?

You can drop a Kali Linux container onto the same network:

```shell
docker compose -f docker-compose.yml \
               -f docker-compose.dev.yml \
               -f docker-compose.kali.yml up -d --build
```

Or stand up a ModSecurity WAF in front, to play with detection and evasion concepts:

```shell
docker compose -f docker-compose.yml \
               -f docker-compose.dev.yml \
               -f docker-compose.mod_security.yml \
               -f docker-compose.kali.yml up -d --build
```

## What's next?

This is a living dojo, and there's plenty of room for it to grow. Some of this may
land here in time; the rest is an open invitation if you'd like to help. On the rough
wish-list:

- **More storylines.** *The Semester Heist* is one path through the campus, but the campus
  could tell other stories with different entry points and themes — an insider "Finals
  Week" grade-fixing job, an alumni-portal takeover, or a supply-chain angle through the
  coursework uploads — so you can come back and attack the same place a different way.
- **Higher-difficulty tiers.** A "hard mode" that hides the hints and clears the
  pre-filled credentials, plus tougher acts that chain bugs further — second-order
  injection, token-algorithm confusion, SSRF that pivots into something worse, and a race
  condition or two — for when the beginner track stops being scary.
- **A defender's track.** Today each act asks *what should have stopped you?*; the natural
  next step is to let you actually fix it. Think guided remediation with secure-by-contrast
  versions of each endpoint, before/after diffs, and a way to re-run the test suite and
  watch the exploit turn red.
- **Detection and monitoring.** The dojo deliberately keeps no audit trail right now.
  A blue-team track could add real logging and then challenge you to spot the heist in the
  logs — turning that missing-logging gap into a hands-on exercise instead of a footnote.
- **WAF exercises.** There's already an optional ModSecurity WAF you can stand up in front
  of the app. A guided set of exercises around it — watching it catch the naive payloads,
  tuning its rules, and understanding where and why it can be bypassed — would close the
  offense/defense loop.
- **More tech to break.** A GraphQL endpoint, an OAuth-style flow with real token
  libraries, or a CI/CD supply-chain scenario would each add a whole new class of weakness
  to the campus.
- **CTF niceties.** Optional per-act flags and a scoreboard, for running this as a
  competition or a graded class assignment.

If any of that sounds fun to build, contributions are welcome.

## Licensing

Released under the MIT License (see `LICENSE.md`). Copyright 2026 cybagard. Share and
enjoy — just keep it in the lab.

## Acknowledgements

Thanks to the [OWASP Foundation](https://owasp.org/) for the Top 10 and API Security Top
10 that frame the whole curriculum here, and to everyone who builds
intentionally-vulnerable teaching apps — this one is proud to stand in that tradition.
