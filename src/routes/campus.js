'use strict';

import express from 'express';
import * as mongo from '../db/mongo.js';

const router = new express.Router();

/**
 * @api {get} /campus/ping GetDatabaseStatus
 * @apiName CampusPing
 * @apiGroup CampusAPI
 * @apiPermission Public
 */
router.get('/ping', async (req, res) => {
  res.send({ environment: process.env.NODE_ENV, ping: await mongo.ping() });
});

/**
 * @api {post} /campus/security/login Login
 * @apiName CampusLogin
 * @apiGroup CampusAPI
 * @apiPermission Public
 */
router.post('/security/login', async (req, res, next) => {
  const query = { name: req.body.username, pass: req.body.password };
  try {
    const data = await mongo.authenticate(query);
    if (data) {
      res.send({ result: 'success', data });
    } else {
      res.status(401).send({ result: 'error', data: 'Username or password invalid.' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
