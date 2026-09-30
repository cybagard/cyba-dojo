'use strict';

import 'dotenv/config';

/**
 * Central configuration for Cyba Dojo.
 *
 * NOTE (learning dojo): several defaults here are intentionally weak so
 * the corresponding weaknesses are reproducible out of the box. See
 * docs/VULN_MAP.md for where each one is exercised.
 */
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Hardcoded, low-entropy session secret (see docs/VULN_MAP.md).
  sessionSecret: process.env.SESSION_SECRET || '9d7f5f4df7290',

  // Symmetric key for the hand-rolled "campus token" issuer.
  campusTokenSecret: process.env.CAMPUS_TOKEN_SECRET || 'campus',

  postgres: {
    host: process.env.PGHOST || 'postgres',
    user: process.env.PGUSER || 'bookuser',
    database: process.env.PGDATABASE || 'books',
    port: parseInt(process.env.PGPORT || '5432', 10),
  },

  mysql: {
    host: process.env.MYSQL_HOST || 'mysql',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
  },

  mongo: {
    host: process.env.MONGO_HOST || 'mongo',
    db: process.env.MONGO_DB || 'campussecurity',
    collection: process.env.MONGO_COLLECTION || 'superadmins',
  },

  // Base URL used by the "internal services" mock (SSRF target surface).
  internalServiceBase: process.env.INTERNAL_SERVICE_BASE || 'http://localhost:3000',
};
