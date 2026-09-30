'use strict';

const API = '/api/v1';
const TABS = [
  ['mission', 'Mission'],
  ['profile', 'Profile'],
  ['registrar', 'Registrar'],
  ['courses', 'Courses'],
  ['tools', 'Tools'],
  ['campus', 'Campus'],
];

let session = null;

/* ============================ mission model ============================ */
// The storyline as a sequential, self-paced path. Acts are numbered 0-6, as in
// docs/STORYLINE.md. Each act names its objective, the screen it uses, a
// conceptual "look for" hint (never a payload), the OWASP class it teaches and
// the defending control. Marking an act done unlocks the next one and asks the
// learner to name the control that should have stopped them.
const ACTS = [
  {
    key: 'recon', title: 'Case the campus', owasp: 'API9 · Misconfiguration',
    objective: 'Map the API surface before touching anything sensitive. Find what the university exposes that it should not.',
    look: 'Compare the published API reference with what actually answers. Some routes never made it into the docs, and the operational endpoints say more than they should.',
    recon: true,
    control: 'Keep an inventory of every route and remove or authenticate what is not in it. <code>/status</code>, <code>/debug</code> and <code>/api/v0</code> must not answer in production, and no response may contain configuration or environment values.',
  },
  {
    key: 'foothold', title: 'Get a foothold', owasp: 'A03 Injection · API2 Broken Auth',
    objective: 'Obtain an authenticated student session.',
    look: 'The sign-in form trusts what you type more than it should. The seeded student1 / student1 account also works if you just want to move on.',
    where: 'profile', whereLabel: 'Open Profile',
    control: 'Parameterised queries on every login, rate limiting and lockout on failed attempts, and salted slow password hashes (bcrypt, scrypt or Argon2) with no default accounts.',
  },
  {
    key: 'peers', title: 'Read the class', owasp: 'API1 · BOLA',
    objective: "Read another student's records — profile and transcript — not just your own.",
    look: 'Look at the id in the request. Does the server ever check that the record is actually yours?',
    where: 'registrar', whereLabel: 'Open Registrar',
    control: 'An ownership check on every object id: compare the owner of the record with the user in the session. Return only the fields the caller needs, never password hashes or keys.',
  },
  {
    key: 'promotion', title: 'Change who you are', owasp: 'API3 · Mass Assignment',
    objective: 'Turn your student account into something more privileged.',
    look: 'The profile editor takes a JSON patch. Which fields does it accept that a student should never control?',
    where: 'profile', whereLabel: 'Open Profile',
    control: 'An allowlist of the fields a user may change (for example display name and email). Properties such as <code>role</code> and <code>gpa</code> are set only by the server.',
  },
  {
    key: 'faculty', title: 'Rewrite the record', owasp: 'API5 · BFLA',
    objective: 'Use a staff-only function: change a grade on a transcript entry.',
    look: 'This endpoint was built for faculty. Ask whether it checks your role at all before it writes.',
    where: 'registrar', whereLabel: 'Open Registrar',
    control: 'A server-side role check on every staff function, plus business rules on the flow itself: valid grade values, the right course and term, and an audit record of who changed what.',
  },
  {
    key: 'campus', title: 'Breach campus security', owasp: 'A03 NoSQL · A02 Crypto',
    objective: 'Get into the campus security store, and forge a trusted campus token.',
    look: "The campus login builds a database query straight from your input. Separately, the token verifier trusts the token's own declared algorithm.",
    where: 'campus', whereLabel: 'Open Campus',
    control: 'Validate input types before building a query (a username is a string, not an object). Verify tokens with a fixed algorithm allowlist that rejects <code>none</code>, a strong secret kept out of responses, and a role check, not just token presence.',
  },
  {
    key: 'takeover', title: 'Reach inside & go quiet', owasp: 'A10 · SSRF · A09 Logging',
    objective: 'Make the server fetch something only it can reach — then note why nobody would notice.',
    look: "The import tools fetch a URL server-side. Where could you point them that your browser can't go directly? Then consider what the logs would (not) show.",
    where: 'tools', whereLabel: 'Open Tools',
    control: 'An allowlist of hosts the server may fetch from, with internal and link-local addresses blocked. Validate upstream data before use. Log privileged actions to an audit trail with alerts, and keep secrets out of logs.',
  },
];

const PROGRESS_KEY = 'heist-progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const n = raw === null ? -1 : parseInt(raw, 10);
    return Number.isNaN(n) ? -1 : n;
  } catch { return -1; }
}
function saveProgress(idx) {
  try { localStorage.setItem(PROGRESS_KEY, String(idx)); } catch { /* per-viewer only */ }
}
// Highest completed act index (-1 = nothing done yet). Completing act k implies
// 0..k are done, which keeps the path strictly sequential.
let doneUpTo = loadProgress();

function completeUpTo(idx) {
  if (idx > doneUpTo) { doneUpTo = idx; saveProgress(doneUpTo); }
  renderMission();
  updateProgressChip();
}
function resetProgress() {
  doneUpTo = -1; saveProgress(-1); renderMission(); updateProgressChip();
}

/* ============================ helpers ============================ */
function $(id) { return document.getElementById(id); }

function render(target, data) {
  const el = $(target);
  el.classList.remove('hidden');
  el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

/* ============================ auth ============================ */
async function doLogin() {
  const username = $('login-user').value;
  const password = $('login-pass').value;
  const { body } = await api('/students/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (body.result === 'success') {
    session = body.data;
    // Reaching the portal completes Recon + Foothold.
    completeUpTo(1);
    enterApp();
  } else {
    render('login-out', body);
  }
}

function enterApp() {
  $('view-login').classList.add('hidden');
  $('view-app').classList.remove('hidden');
  updateSessionChip();
  buildTabs();
  renderMission();
  updateProgressChip();
  gotoTab('mission');
  loadProfile();
}

function updateSessionChip() {
  $('session').innerHTML =
    `signed in as <b>#${session.id}</b> <span class="tag ${session.role}">${session.role}</span>`;
}

function updateProgressChip() {
  const el = $('progress-chip');
  if (!el) return;
  el.classList.remove('hidden');
  const current = Math.min(doneUpTo + 1, ACTS.length - 1);
  const label = doneUpTo >= ACTS.length - 1
    ? 'Mission complete ✓'
    : `Act ${current} · ${ACTS[current].title}`;
  el.textContent = label;
  el.dataset.act = current;
}

/* ============================ tabs ============================ */
function buildTabs() {
  const wrap = $('tabs');
  wrap.innerHTML = '';
  TABS.forEach(([key, label], i) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.tabkey = key;
    b.className = i === 0 ? 'active' : '';
    b.onclick = () => selectTab(key, b);
    wrap.appendChild(b);
  });
}

function selectTab(key, btn) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.tab !== key);
  });
}

function gotoTab(key) {
  const btn = document.querySelector(`.tabs button[data-tabkey="${key}"]`);
  selectTab(key, btn);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================ mission console ============================ */
function actStatus(i) {
  if (i <= doneUpTo) return 'done';
  if (i === doneUpTo + 1) return 'active';
  return 'locked';
}

function renderMission() {
  const el = $('mission');
  if (!el) return;

  const total = ACTS.length;
  const pct = Math.round(((doneUpTo + 1) / total) * 100);

  let html = `
    <div class="mission-head">
      <div>
        <h2 class="m-title">The Semester Heist</h2>
        <p class="hint">A self-paced path from student to campus superadmin. Finish one act to unlock the next — at your own pace.</p>
      </div>
      <button class="btn ghost small" onclick="resetProgress()">Reset progress</button>
    </div>
    <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <p class="progress-label">${Math.min(doneUpTo + 1, total)} of ${total} acts complete</p>
    <div class="steps">`;

  ACTS.forEach((act, i) => {
    const status = actStatus(i);
    const num = i;
    const badge = status === 'done' ? '✓' : (status === 'locked' ? '🔒' : num);

    html += `<div class="step ${status}">
      <div class="step-marker">${badge}</div>
      <div class="step-body">
        <div class="step-top">
          <span class="step-name">Act ${num} · ${act.title}</span>
          <span class="tag owasp">${act.owasp}</span>
        </div>`;

    if (status !== 'locked') {
      html += `<p class="step-obj">${act.objective}</p>`;
      if (status === 'active') {
        html += `<div class="step-hint"><b>Look for:</b> ${act.look}</div>`;
        html += '<div class="step-actions">';
        if (act.recon) {
          html += `
            <a class="btn small" href="/apidoc" target="_blank">API reference ↗</a>
            <a class="btn small ghost" href="/status" target="_blank">Status ↗</a>
            <a class="btn small ghost" href="/debug" target="_blank">Diagnostics ↗</a>
            <a class="btn small ghost" href="/api/v0/students/1" target="_blank">Legacy API ↗</a>`;
        } else if (act.where) {
          html += `<button class="btn small" onclick="gotoTab('${act.where}')">${act.whereLabel} →</button>`;
        }
        const nextLabel = i >= total - 1 ? 'Finish mission ✓' : 'Mark done → next act';
        html += `<button class="btn small solid" onclick="completeUpTo(${i})">${nextLabel}</button>`;
        html += `<a class="doc-link" href="/docs/STORYLINE.md" target="_blank">walkthrough</a>`;
        html += '</div>';
      } else if (status === 'done') {
        html += `<div class="step-defend"><b>Defend:</b> which control should have stopped you? Answer first, then check.
          <details><summary>Show the control</summary><p>${act.control}</p></details></div>`;
        if (act.where) {
          html += `<div class="step-actions"><button class="btn small ghost" onclick="gotoTab('${act.where}')">Revisit ${act.whereLabel.replace('Open ', '')} →</button></div>`;
        }
      }
    }

    html += '</div></div>';
  });

  html += '</div>';
  if (doneUpTo >= total - 1) {
    html += `<div class="mission-done">🎓 You walked the whole campus. Now flip it: each act above names the control that should have stopped you. Compare them with your own answers and the <a href="/docs/VULN_MAP.md" target="_blank">weakness map</a>.</div>`;
  }
  el.innerHTML = html;
}

/* ============================ profile ============================ */
async function loadProfile() {
  const { body } = await api('/me');
  render('profile-out', body.data || body);
}

async function patchProfile() {
  let patch;
  try { patch = JSON.parse($('profile-patch').value); }
  catch (e) { return render('patch-out', 'Invalid JSON: ' + e.message); }
  const { body } = await api('/me', { method: 'PATCH', body: JSON.stringify(patch) });
  render('patch-out', body);
  if (body.data && body.data.role) {
    session.role = body.data.role;
    updateSessionChip();
  }
}

/* ============================ registrar ============================ */
async function loadTranscript() {
  const id = $('tr-id').value;
  const { body } = await api('/registrar/transcript/' + encodeURIComponent(id));
  const rows = Array.isArray(body.data) ? body.data : [];
  let html = '<table><tr><th>id</th><th>student</th><th>course</th><th>term</th><th>grade</th></tr>';
  rows.forEach((r) => {
    html += `<tr><td>${r.id}</td><td>${r.student_id}</td><td>${r.course}</td><td>${r.term}</td><td>${r.grade}</td></tr>`;
  });
  html += '</table>';
  if (!rows.length) html = '<pre class="out">' + JSON.stringify(body, null, 2) + '</pre>';
  $('tr-table').innerHTML = html;
}

async function enroll() {
  const { body } = await api('/registrar/enroll', {
    method: 'POST',
    body: JSON.stringify({
      studentId: $('en-id').value, course: $('en-course').value, term: $('en-term').value,
    }),
  });
  render('en-out', body);
}

async function setGrade() {
  const { body } = await api('/registrar/grade', {
    method: 'POST',
    body: JSON.stringify({ transcriptId: $('gr-id').value, grade: $('gr-grade').value }),
  });
  render('gr-out', body);
}

/* ============================ courses ============================ */
async function loadAnnouncements() {
  const { body } = await api('/courses/announcements');
  const list = $('ann-list');
  list.innerHTML = '';
  (body.data || []).forEach((a) => {
    const div = document.createElement('div');
    div.className = 'announcement';
    div.innerHTML = `<div class="who">${a.author}</div>${a.html}`;
    list.appendChild(div);
  });
}

async function postAnnouncement() {
  await api('/courses/announcements', {
    method: 'POST',
    body: JSON.stringify({ body: $('ann-body').value }),
  });
  loadAnnouncements();
}

async function uploadMaterial() {
  const file = $('mat-file').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('checksum', $('mat-sum').value);
  const res = await fetch(API + '/courses/materials', {
    method: 'POST', credentials: 'include', body: fd,
  });
  await res.json();
  loadMaterials();
}

async function loadMaterials() {
  const { body } = await api('/courses/materials');
  const rows = body.data || [];
  let html = '<table><tr><th>id</th><th>name</th><th>path</th><th>checksum</th></tr>';
  rows.forEach((r) => {
    html += `<tr><td>${r.id}</td><td>${r.original_name}</td><td><a href="${r.stored_path}" target="_blank">${r.stored_path}</a></td><td>${r.checksum || '—'}</td></tr>`;
  });
  html += '</table>';
  $('mat-table').innerHTML = html;
}

/* ============================ tools ============================ */
async function importAvatar() {
  const { body } = await api('/me/avatar/import', {
    method: 'POST', body: JSON.stringify({ url: $('av-url').value }),
  });
  render('av-out', body);
}

async function importTimetable() {
  const { body } = await api('/me/timetable/import', {
    method: 'POST', body: JSON.stringify({ feedUrl: $('tt-url').value }),
  });
  render('tt-out', body);
}

/* ============================ campus ============================ */
async function campusLogin() {
  const { body } = await api('/campus/security/login', {
    method: 'POST',
    body: JSON.stringify({ username: $('cs-user').value, password: $('cs-pass').value }),
  });
  render('cs-out', body);
}

async function ssoToken() {
  const { body } = await api('/sso/token', {
    method: 'POST',
    body: JSON.stringify({ username: $('sso-user').value, password: $('sso-pass').value }),
  });
  if (body.data && body.data.token) $('sso-token').value = body.data.token;
  render('sso-out', body);
}

async function ssoWhoami() {
  const { body } = await api('/sso/whoami', {
    headers: { Authorization: 'Bearer ' + $('sso-token').value },
  });
  render('sso-out', body);
}

async function ssoRoster() {
  const { body } = await api('/sso/admin/roster', {
    headers: { Authorization: 'Bearer ' + $('sso-token').value },
  });
  render('sso-out', body);
}
