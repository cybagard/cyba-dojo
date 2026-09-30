'use strict';

import app from './app.js';
import { config } from './config.js';

import * as postgres from './db/postgres.js';
import * as mysql from './db/mysql.js';
import * as mongo from './db/mongo.js';
import * as sqlite from './db/sqlite.js';

async function safeInit(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[init] ${name} unavailable: ${err.message}`);
  }
}

async function bootstrap() {
  // SQLite is in-memory and always available.
  await safeInit('sqlite', () => sqlite.init());
  // The remaining stores require their containers to be reachable.
  await safeInit('postgres', () => postgres.init());
  await safeInit('mysql', () => mysql.init());
  await safeInit('mongo', () => mongo.init());

  app.listen(config.port, () => {
    console.log(`Cyba Dojo listening on port ${config.port} (${config.env})`);
  });
}

bootstrap();
