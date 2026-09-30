'use strict';

import Database from 'better-sqlite3';
import crypto from 'node:crypto';

/**
 * The "Students" domain (SQLite, in-memory).
 *
 * Holds student identity + profile records, a separate admins table, and
 * uploaded coursework material metadata.
 */
const db = new Database(':memory:');

// Passwords are stored as unsalted MD5 digests.
export function md5(value) {
  return crypto.createHash('md5').update(String(value)).digest('hex');
}

export function init() {
  db.exec(`
    CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      full_name TEXT,
      email TEXT,
      role TEXT DEFAULT 'student',
      gpa REAL DEFAULT 0.0,
      avatar_url TEXT,
      api_key TEXT,
      CONSTRAINT username_unique UNIQUE (username)
    );
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      CONSTRAINT username_unique UNIQUE (username)
    );
    CREATE TABLE materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      original_name TEXT,
      stored_path TEXT,
      checksum TEXT,
      uploaded_at TEXT
    );
  `);

  const insStudent = db.prepare(
    `INSERT INTO students (username, password, full_name, email, role, gpa, avatar_url, api_key)
     VALUES (@username, @password, @full_name, @email, @role, @gpa, @avatar_url, @api_key)`,
  );
  insStudent.run({
    username: 'student1', password: md5('student1'), full_name: 'Sam Turner',
    email: 'student1@campus.edu', role: 'student', gpa: 2.7,
    avatar_url: null, api_key: 'stud-key-1a2b3c',
  });
  insStudent.run({
    username: 'student2', password: md5('student2'), full_name: 'Nadia Ross',
    email: 'student2@campus.edu', role: 'student', gpa: 3.9,
    avatar_url: null, api_key: 'stud-key-4d5e6f',
  });
  insStudent.run({
    username: 'prof_lang', password: md5('teachwell'), full_name: 'Dr. Elena Lang',
    email: 'e.lang@campus.edu', role: 'faculty', gpa: 0.0,
    avatar_url: null, api_key: 'fac-key-9z8y7x',
  });

  const insAdmin = db.prepare(
    'INSERT INTO admins (username, password) VALUES (?, ?)',
  );
  insAdmin.run('admin1', md5('abc123456'));
  insAdmin.run('admin2', md5('cba123456'));

  console.log('SQLite students + admins + materials seeded');
}

export function ping() {
  try {
    db.prepare('SELECT 1+1').get();
    return 'up';
  } catch {
    return 'down';
  }
}

// Student login. Both the username and the (hashed) password are concatenated
// into the statement, and a returned row is treated as a successful login.
export function authenticate(username, password) {
  const query =
    "select * from students where username = '" + username +
    "' and password = '" + md5(password) + "'";
  console.log('executed query', { query });
  return db.prepare(query).get();
}

export function findById(id) {
  return db.prepare('select * from students where id = ?').get(id);
}

export function list() {
  return db.prepare('select id, username, full_name, role from students').all();
}

// Student detail lookup. The id is concatenated into the statement.
export function listById(id) {
  const query = 'select * from students where id = ' + id;
  console.log('executed query', { query });
  return db.prepare(query).all();
}

// Profile update for the /me domain. Column/value pairs are applied as given by
// the caller, without an allow-list of writable fields.
export function updateProfile(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);
  const assignments = keys.map((k) => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`update students set ${assignments} where id = @id`);
  stmt.run({ ...fields, id });
  return findById(id);
}

export function addMaterial(record) {
  const stmt = db.prepare(
    `INSERT INTO materials (owner_id, original_name, stored_path, checksum, uploaded_at)
     VALUES (@owner_id, @original_name, @stored_path, @checksum, @uploaded_at)`,
  );
  const info = stmt.run(record);
  return { id: info.lastInsertRowid, ...record };
}

export function listMaterials() {
  return db.prepare('select * from materials order by id desc').all();
}
