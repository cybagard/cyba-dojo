'use strict';

import express from 'express';
import * as sqlite from '../db/sqlite.js';
import { requireSession } from '../middleware/auth.js';

const router = new express.Router();

/**
 * @api {get} /students/ping GetDatabaseStatus
 * @apiName StudentsPing
 * @apiGroup StudentsAPI
 * @apiPermission Public
 */
router.get('/ping', (req, res) => {
  res.send({ environment: process.env.NODE_ENV, ping: sqlite.ping() });
});

/**
 * @api {post} /students/login Login
 * @apiName StudentsLogin
 * @apiGroup StudentsAPI
 * @apiPermission Public
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  let user;
  try {
    user = sqlite.authenticate(username, password);
  } catch (err) {
    return res.status(400).json({ result: 'error', data: err.message });
  }
  if (!user) {
    return res.status(401).json({ result: 'error', data: 'unauthorized' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ result: 'success', data: { id: user.id, role: user.role } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ result: 'success' }));
});

/**
 * @api {get} /students/list ListAllDetails
 * @apiName StudentsList
 * @apiGroup StudentsAPI
 * @apiPermission Authenticated
 */
router.get('/list', requireSession, (req, res) => {
  res.json({ result: 'success', data: sqlite.list() });
});

/**
 * @api {get} /students/list/:id ListDetailsByStudentId
 * @apiName StudentsListById
 * @apiGroup StudentsAPI
 * @apiPermission Authenticated
 */
router.get('/list/:id', requireSession, (req, res) => {
  try {
    const rows = sqlite.listById(req.params.id);
    res.json({ result: 'success', data: rows });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

export default router;
