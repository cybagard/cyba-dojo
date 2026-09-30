'use strict';

import express from 'express';
import * as sqlite from '../db/sqlite.js';
import { issueToken } from '../services/tokens.js';

const router = new express.Router();

/**
 * @api {post} /sso/token IssueToken
 * @apiName IssueToken
 * @apiGroup SsoAPI
 * @apiPermission Public
 * @apiDescription Exchanges student credentials for a campus token.
 */
router.post('/token', (req, res) => {
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
  const token = issueToken({ sub: user.id, name: user.username, role: user.role });
  res.json({ result: 'success', data: { token } });
});

/**
 * @api {get} /sso/whoami WhoAmI
 * @apiName WhoAmI
 * @apiGroup SsoAPI
 * @apiPermission Token
 * @apiDescription Returns the identity encoded in the supplied campus token.
 */
router.get('/whoami', (req, res) => {
  if (!req.campus) {
    return res.status(401).json({ result: 'error', data: 'no valid token' });
  }
  res.json({ result: 'success', data: req.campus });
});

/**
 * @api {get} /sso/admin/roster AdminRoster
 * @apiName AdminRoster
 * @apiGroup SsoAPI
 * @apiPermission Admin
 * @apiDescription Returns the full campus roster including contact and key data.
 */
router.get('/admin/roster', (req, res) => {
  // Requires a token to be present.
  if (!req.campus) {
    return res.status(401).json({ result: 'error', data: 'no valid token' });
  }
  const roster = sqlite.list().map((s) => sqlite.findById(s.id));
  res.json({ result: 'success', data: roster });
});

export default router;
