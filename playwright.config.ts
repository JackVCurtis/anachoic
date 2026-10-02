import { defineConfig, devices } from '@playwright/test'

/**
 * One worker, because every test's server listens on 127.0.0.1:3001 and the
 * reference host on its fixed ports.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  globalSetup: './tests/e2e/global_setup.ts',
  forbidOnly: !!process.env.CI,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
