'use strict';

import express from 'express';
import * as postgres from '../db/postgres.js';
import { requireSession } from '../middleware/auth.js';

const router = new express.Router();

/**
 * @api {get} /registrar/transcript/:studentId GetTranscript
 * @apiName GetTranscript
 * @apiGroup RegistrarAPI
 * @apiPermission Authenticated
 * @apiDescription Returns the academic transcript for a student id.
 */
router.get('/transcript/:studentId', requireSession, async (req, res) => {
  try {
    const result = await postgres.transcriptByStudentId(req.params.studentId);
    res.json({ result: 'success', data: result.rows });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

/**
 * @api {post} /registrar/enroll Enroll
 * @apiName Enroll
 * @apiGroup RegistrarAPI
 * @apiPermission Authenticated
 * @apiDescription Enrolls a student id into a course for a term.
 */
router.post('/enroll', requireSession, async (req, res) => {
  const { studentId, course, term } = req.body;
  try {
    const result = await postgres.enroll(studentId, course, term);
    res.json({ result: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

/**
 * @api {post} /registrar/grade UpdateGrade
 * @apiName UpdateGrade
 * @apiGroup RegistrarAPI
 * @apiPermission Faculty
 * @apiDescription Sets the grade on a transcript entry.
 */
router.post('/grade', requireSession, async (req, res) => {
  const { transcriptId, grade } = req.body;
  try {
    const result = await postgres.updateGrade(transcriptId, grade);
    res.json({ result: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ result: 'error', data: err.message });
  }
});

export default router;
