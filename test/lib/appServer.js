'use strict';

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Spawn the application as a child process against the configured datastores,
 * wait until it is listening AND every datastore has seeded, and return a
 * handle. If any datastore fails to seed, throws — the E2E requires the full
 * stack (no room for partial runs).
 */
export async function startApp() {
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'development',
    PGHOST: process.env.PGHOST || 'localhost',
    MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
    MONGO_HOST: process.env.MONGO_HOST || 'localhost',
  };
  const child = spawn('node', ['src/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d.toString(); });
  child.stderr.on('data', (d) => { log += d.toString(); });

  const base = `http://localhost:${port}`;
  const REQUIRED = [
    'SQLite students',
    'PostgreSQL library + registrar seeded',
    'MySQL lending logins seeded',
    'MongoDB campus superadmins seeded',
  ];

  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline) {
    if (log.includes('unavailable')) {
      child.kill('SIGKILL');
      throw new Error(`A datastore was unavailable during boot. Log:\n${log}`);
    }
    if (REQUIRED.every((m) => log.includes(m))) {
      try {
        const r = await fetch(base + '/api/v1/students/ping');
        if (r.ok) { ready = true; break; }
      } catch { /* not up yet */ }
    }
    await sleep(300);
  }
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error(`App did not become ready with all datastores seeded within timeout. Log:\n${log}`);
  }

  return {
    base,
    getLog: () => log,
    stop: () => new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill('SIGKILL');
    }),
  };
}
