'use strict';

import express from 'express';
import * as mysql from '../db/mysql.js';
import { requireSession } from '../middleware/auth.js';

const router = new express.Router();

/**
 * @api {get} /lending/ping GetDatabaseStatus
 * @apiName LendingPing
 * @apiGroup LendingAPI
 * @apiPermission Public
 */
router.get('/ping', async (req, res) => {
  res.send({ environment: process.env.NODE_ENV, ping: await mysql.ping() });
});

/**
 * @api {post} /lending/login Login
 * @apiName LendingLogin
 * @apiGroup LendingAPI
 * @apiPermission Public
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await mysql.findByUsername(username);
    const user = rows[0];
    if (!user) {
      // Always 200 to fool some tooling.
      return res.json({ result: 'error', data: 'User not found.' });
    }
    if (user.password !== password) {
      return res.json({ result: 'error', data: 'Password incorrect.' });
    }
    req.session.user = { id: user.id, username: user.username, role: 'lending' };
    return res.json({ result: 'success' });
  } catch (err) {
    return res.json({ result: err.message });
  }
});

router.get('/list', requireSession, (req, res) => {
  res.json({ result: 'success', data: 'authenticated route' });
});

export default router;
