'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import marked from 'marked';

import * as sqlite from '../db/sqlite.js';
import { requireSession } from '../middleware/auth.js';

const router = new express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Uploaded files are stored under their original client-supplied name.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// In-memory announcement board for the courses domain.
const announcements = [
  { id: 1, author: 'Dr. Elena Lang', body: 'Welcome to **CS210**. Slides are posted.' },
];

/**
 * @api {post} /courses/materials UploadMaterial
 * @apiName UploadMaterial
 * @apiGroup CoursesAPI
 * @apiPermission Authenticated
 * @apiDescription Uploads a course material file. An optional checksum may be
 * supplied by the client and is stored alongside the record.
 */
router.post('/materials', requireSession, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ result: 'error', data: 'no file' });
  }
  const record = sqlite.addMaterial({
    owner_id: req.session.user.id,
    original_name: req.file.originalname,
    stored_path: `/uploads/${req.file.originalname}`,
    checksum: req.body.checksum || null,
    uploaded_at: new Date().toISOString(),
  });
  res.json({ result: 'success', data: record });
});

/**
 * @api {get} /courses/materials ListMaterials
 * @apiName ListMaterials
 * @apiGroup CoursesAPI
 * @apiPermission Public
 */
router.get('/materials', (req, res) => {
  res.json({ result: 'success', data: sqlite.listMaterials() });
});

/**
 * @api {get} /courses/announcements ListAnnouncements
 * @apiName ListAnnouncements
 * @apiGroup CoursesAPI
 * @apiPermission Public
 * @apiDescription Returns announcements with their markdown rendered to HTML.
 */
router.get('/announcements', (req, res) => {
  const rendered = announcements.map((a) => ({
    id: a.id,
    author: a.author,
    html: marked(a.body),
  }));
  res.json({ result: 'success', data: rendered });
});

/**
 * @api {post} /courses/announcements PostAnnouncement
 * @apiName PostAnnouncement
 * @apiGroup CoursesAPI
 * @apiPermission Authenticated
 */
router.post('/announcements', requireSession, (req, res) => {
  const entry = {
    id: announcements.length + 1,
    author: req.body.author || req.session.user.username,
    body: req.body.body || '',
  };
  announcements.push(entry);
  res.json({ result: 'success', data: entry });
});

export default router;
