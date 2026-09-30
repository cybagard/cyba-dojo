'use strict';

import express from 'express';
import { config } from '../config.js';
import * as sqlite from '../db/sqlite.js';

const router = new express.Router();

/**
 * @api {get} /status Status
 * @apiName Status
 * @apiGroup OpsAPI
 * @apiPermission Public
 * @apiDescription Operational status and runtime environment details.
 */
router.get('/status', (req, res) => {
  res.json({
    result: 'success',
    data: {
      env: config.env,
      node: process.version,
      uptime: process.uptime(),
      pid: process.pid,
      config: {
        postgres: config.postgres,
        mysql: config.mysql,
        mongo: config.mongo,
        sessionSecret: config.sessionSecret,
        campusTokenSecret: config.campusTokenSecret,
      },
    },
  });
});

// Diagnostic echo. Not listed in the published API reference.
router.get('/debug', (req, res) => {
  res.json({
    result: 'success',
    data: {
      headers: req.headers,
      session: req.session,
      cookies: req.cookies,
      campus: req.campus,
      env: process.env,
    },
  });
});

// Legacy v0 student lookup, kept for backwards compatibility with old clients.
router.get('/api/v0/students/:id', (req, res) => {
  const record = sqlite.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ result: 'error', data: 'not found' });
  }
  res.json({ result: 'success', data: record });
});

export default router;
