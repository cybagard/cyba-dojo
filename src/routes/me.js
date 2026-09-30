'use strict';

import express from 'express';
import * as sqlite from '../db/sqlite.js';
import { fetchUrl, importTimetable } from '../services/fetcher.js';
import { requireSession } from '../middleware/auth.js';

const router = new express.Router();

/**
 * @api {get} /me Profile
 * @apiName GetProfile
 * @apiGroup ProfileAPI
 * @apiPermission Authenticated
 * @apiDescription Returns the current student's profile record.
 */
router.get('/', requireSession, (req, res) => {
  const record = sqlite.findById(req.session.user.id);
  res.json({ result: 'success', data: record });
});

/**
 * @api {patch} /me UpdateProfile
 * @apiName UpdateProfile
 * @apiGroup ProfileAPI
 * @apiPermission Authenticated
 * @apiDescription Updates the current student's profile with the supplied fields.
 */
router.patch('/', requireSession, (req, res) => {
  try {
    const updated = sqlite.updateProfile(req.session.user.id, req.body);
    // Keep the session role in sync with the stored record.
    req.session.user.role = updated.role;
    res.json({ result: 'success', data: updated });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

/**
 * @api {post} /me/avatar/import ImportAvatar
 * @apiName ImportAvatar
 * @apiGroup ProfileAPI
 * @apiPermission Authenticated
 * @apiDescription Fetches an avatar image from a URL and attaches it to the profile.
 */
router.post('/avatar/import', requireSession, async (req, res) => {
  const { url } = req.body;
  try {
    const fetched = await fetchUrl(url, { asText: true });
    sqlite.updateProfile(req.session.user.id, { avatar_url: url });
    res.json({
      result: 'success',
      data: {
        url,
        status: fetched.status,
        contentType: fetched.contentType,
        preview: String(fetched.body).slice(0, 512),
      },
    });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

/**
 * @api {post} /me/timetable/import ImportTimetable
 * @apiName ImportTimetable
 * @apiGroup ProfileAPI
 * @apiPermission Authenticated
 * @apiDescription Imports a timetable from a third-party feed URL.
 */
router.post('/timetable/import', requireSession, async (req, res) => {
  const { feedUrl } = req.body;
  try {
    const timetable = await importTimetable(feedUrl);
    res.json({ result: 'success', data: timetable });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

export default router;
