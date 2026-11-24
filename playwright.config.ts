import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4321' },
  // --ignore-lock keeps `astro preview` in the foreground: Astro 7 backgrounds it when an AI agent runs it
  webServer: { command: 'pnpm preview --port 4321 --ignore-lock', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
});
