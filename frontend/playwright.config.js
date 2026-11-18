import { defineConfig } from '@playwright/test';

// Both values are required before these optional, stateful demo tests can run.
export const disposableE2EEnabled =
  process.env.SINFRENO_E2E_ALLOW_DISPOSABLE === '1' &&
  Boolean(process.env.SINFRENO_E2E_URL);

function disposableBaseURL() {
  if (!disposableE2EEnabled) return undefined;
  let url;
  try {
    url = new URL(process.env.SINFRENO_E2E_URL);
  } catch {
    throw new Error('SINFRENO_E2E_URL must be the isolated local demo URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '15180' ||
    url.pathname !== '/' ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error(
      'E2E requires the disposable demo at http://127.0.0.1:15180 or http://localhost:15180.',
    );
  }
  return url.origin;
}

const executablePath = process.env.SINFRENO_E2E_EXECUTABLE_PATH;
const channel = process.env.SINFRENO_E2E_CHANNEL;
if (channel && channel !== 'msedge') {
  throw new Error('SINFRENO_E2E_CHANNEL, when supplied, must be msedge.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [['list']],
  outputDir: '../.recovery/portfolio-qa-20261118-playwright',
  use: {
    baseURL: disposableBaseURL(),
    browserName: 'chromium',
    ...(executablePath ? { launchOptions: { executablePath } } : { channel }),
    headless: true,
    viewport: { width: 1440, height: 1000 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    actionTimeout: 12_000,
    navigationTimeout: 15_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
