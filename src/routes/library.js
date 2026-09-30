'use strict';

import express from 'express';
import * as postgres from '../db/postgres.js';

const router = new express.Router();

/**
 * @api {get} /library/ping GetDatabaseStatus
 * @apiName LibraryPing
 * @apiGroup LibraryAPI
 * @apiPermission Public
 */
router.get('/ping', async (req, res) => {
  res.send({ environment: process.env.NODE_ENV, ping: await postgres.ping() });
});

/**
 * @api {get} /library/list/student/:id ListBooksByStudentId
 * @apiName ListBooksByStudentId
 * @apiGroup LibraryAPI
 * @apiPermission Public
 */
router.get('/list/student/:id', async (req, res) => {
  // Whitespace is stripped before the value is used.
  const id = req.params.id.replace(/[ ]/gim, '').trim();
  try {
    const result = await postgres.listByStudentId(id);
    res.json({ result: 'success', data: result.rows });
  } catch {
    res.status(400).json({ result: 'error' });
  }
});

/**
 * @api {get} /library/list/book/:id ListBookByBookId
 * @apiName ListBooksByBookId
 * @apiGroup LibraryAPI
 * @apiPermission Public
 */
router.get('/list/book/:id', async (req, res) => {
  try {
    const result = await postgres.listByBookId(req.params.id);
    res.json({ result: 'success', data: result.rows });
  } catch {
    res.status(400).json({ result: 'error' });
  }
});

export default router;
