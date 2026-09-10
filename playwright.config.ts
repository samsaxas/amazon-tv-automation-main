import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Amazon.in TV search automation suite.
 *
 * Production-readiness decisions:
 *  - Generous timeouts: Amazon.in is a heavy, third-party site with dynamic
 *    content, interstitials (location pop-ups, cookie banners, captchas),
 *    and lazy-loaded sections.
 *  - Single worker / no parallelism in CI: reduces the chance of
 *    triggering Amazon's bot-detection / rate-limiting and keeps console log
 *    output readable and ordered.
 *  - Retries enabled: CI retries handle transient network or layout shifts.
 *  - Trace/video/screenshot capture on failure: essential for debugging in CI.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000, // 120s per test — Amazon.in pages can be heavy
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://www.amazon.in',
    headless: true,
    launchOptions:{
      slowMo:5000
    },
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
