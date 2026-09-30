'use strict';

import { verifyToken } from '../services/tokens.js';

/**
 * Session-based gate for the student/faculty portal.
 */
export function requireSession(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ result: 'error', data: 'unauthorized' });
}

/**
 * Populate req.campus from a campus token supplied by the client, when present.
 * Does not reject the request on its own.
 */
export function campusToken(req, res, next) {
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const raw = bearer || req.get('x-campus-token') || null;
  const payload = raw ? verifyToken(raw) : null;
  req.campus = payload;
  next();
}
