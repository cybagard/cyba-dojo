'use strict';

import mysql from 'mysql2/promise';
import { config } from '../config.js';

/**
 * The "Lending" domain login store (MySQL).
 *
 * multipleStatements is enabled on the pool.
 */
const pool = mysql.createPool({
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function init() {
  const seed =
    'CREATE DATABASE IF NOT EXISTS logins DEFAULT CHARACTER SET utf8; ' +
    'USE logins;' +
    'DROP TABLE IF EXISTS login;' +
    'CREATE TABLE IF NOT EXISTS login (' +
    '  id int(2) NOT NULL,' +
    '  username varchar(50) NOT NULL,' +
    '  password varchar(255) NOT NULL' +
    ') ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8;' +
    'INSERT IGNORE INTO login (id, username, password) VALUES ' +
    '  (1, "admin", "admin"), (2, "librarian", "books4all");' +
    'ALTER TABLE login ADD PRIMARY KEY (id);';
  await pool.query(seed);
  console.log('MySQL lending logins seeded');
}

export async function ping() {
  try {
    await pool.query('SELECT now()');
    return 'up';
  } catch {
    return 'down';
  }
}

// Lending login lookup. The username is concatenated into the statement and
// the password is compared afterwards, in the route handler.
export async function findByUsername(username) {
  const query = 'select * from logins.login where username = "' + username + '"';
  console.log('executed query', { query });
  const [rows] = await pool.query(query);
  return rows;
}
