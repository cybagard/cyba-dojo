import { defineConfig } from '@playwright/test';

const PORT = process.env.UI_PORT || '3000';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './test',
  testMatch: /.*\.spec\.js$/,
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    headless: true,
    // In sandboxes with a pre-installed Chromium, point Playwright at it via
    // PW_CHROMIUM_PATH; otherwise Playwright uses its managed browser.
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'node src/server.js',
    url: `${BASE_URL}/api/v1/students/ping`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      PORT,
      NODE_ENV: 'development',
      PGHOST: process.env.PGHOST || 'localhost',
      MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
      MONGO_HOST: process.env.MONGO_HOST || 'localhost',
    },
  },
});
