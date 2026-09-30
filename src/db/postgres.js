'use strict';

import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.postgres.host,
  user: config.postgres.user,
  database: config.postgres.database,
  port: config.postgres.port,
});

/**
 * Seed the "Library" (book lending) and part of the "Registrar" (academic
 * transcripts) data. Runs once on boot; safe to re-run.
 */
export async function init() {
  await pool.query(`
    DROP TABLE IF EXISTS books;
    CREATE TABLE IF NOT EXISTS books (
      id serial PRIMARY KEY,
      name varchar UNIQUE,
      studentId int NOT NULL,
      available bool NOT NULL DEFAULT TRUE
    );
    INSERT INTO books (name, studentId, available) VALUES
      ('SQLi Attacks', 1, FALSE),
      ('OS Attacks', 1, FALSE),
      ('XSS Attacks', 2, FALSE),
      ('Applied Cryptography', 3, TRUE),
      ('Secure API Design', 2, TRUE);

    DROP TABLE IF EXISTS transcripts;
    CREATE TABLE IF NOT EXISTS transcripts (
      id serial PRIMARY KEY,
      student_id int NOT NULL,
      course varchar NOT NULL,
      term varchar NOT NULL,
      grade varchar NOT NULL
    );
    INSERT INTO transcripts (student_id, course, term, grade) VALUES
      (1, 'CS101 Intro to Programming', '2024-FALL', 'B'),
      (1, 'CS210 Web Systems', '2025-SPRING', 'C'),
      (2, 'CS101 Intro to Programming', '2024-FALL', 'A'),
      (2, 'MA140 Discrete Math', '2024-FALL', 'A'),
      (3, 'CS330 Cryptography', '2025-SPRING', 'A');
  `);
  console.log('PostgreSQL library + registrar seeded');
}

export async function ping() {
  try {
    await pool.query('SELECT now()');
    return 'up';
  } catch {
    return 'down';
  }
}

// Book lookup by student id. Query is assembled by concatenation.
export async function listByStudentId(id) {
  const query = 'select * from books where studentId = ' + id;
  console.log('executed query', { query });
  return pool.query(query);
}

// Book lookup by book id. Uses a bound parameter.
export async function listByBookId(id) {
  const query = 'select * from books where id = $1';
  return pool.query(query, [id]);
}

// Transcript lookup for the Registrar domain. Query is assembled by
// concatenation and no ownership check is applied to the caller.
export async function transcriptByStudentId(studentId) {
  const query =
    'select id, student_id, course, term, grade from transcripts ' +
    'where student_id = ' + studentId + ' order by term';
  console.log('executed query', { query });
  return pool.query(query);
}

// Faculty grade update for the Registrar domain.
export async function updateGrade(transcriptId, grade) {
  const query = 'update transcripts set grade = $1 where id = $2 returning *';
  return pool.query(query, [grade, transcriptId]);
}

export async function enroll(studentId, course, term) {
  const query =
    'insert into transcripts (student_id, course, term, grade) ' +
    'values ($1, $2, $3, $4) returning *';
  return pool.query(query, [studentId, course, term, 'IP']);
}
