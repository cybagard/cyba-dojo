'use strict';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config.js';
import { campusToken } from './middleware/auth.js';

import libraryRouter from './routes/library.js';
import lendingRouter from './routes/lending.js';
import campusRouter from './routes/campus.js';
import studentsRouter from './routes/students.js';
import registrarRouter from './routes/registrar.js';
import meRouter from './routes/me.js';
import coursesRouter from './routes/courses.js';
import ssoRouter from './routes/sso.js';
import legacyRouter from './routes/legacy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const app = express();

app.set('json spaces', 2);

app.use(morgan('dev'));

// Reflective CORS: any origin is echoed back and credentials are allowed.
app.use(cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 500000 },
}));

app.use(campusToken);

// API surface
app.use('/api/v1/library', libraryRouter);
app.use('/api/v1/lending', lendingRouter);
app.use('/api/v1/campus', campusRouter);
app.use('/api/v1/students', studentsRouter);
app.use('/api/v1/registrar', registrarRouter);
app.use('/api/v1/me', meRouter);
app.use('/api/v1/courses', coursesRouter);
app.use('/api/v1/sso', ssoRouter);

// Legacy + operational surface (also mounts /api/v0, /debug, /status)
app.use('/', legacyRouter);

// Generated API reference and uploaded material are served statically.
app.use('/apidoc', express.static(path.join(rootDir, 'public', 'apidoc')));
app.use('/uploads', express.static(path.join(rootDir, 'uploads')));

// Learning docs (vuln map, storyline, coverage) are served for the portal to link to.
app.use('/docs', express.static(path.join(rootDir, 'docs')));

// Portal frontend
app.use('/', express.static(path.join(rootDir, 'public', 'portal')));

// 404
app.use((req, res) => {
  res.status(404).json({ result: 'error', data: 'not found' });
});

// Error handler: the message and stack are returned to the client.
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    result: 'error',
    message: err.message,
    stack: err.stack,
  });
});

export default app;
