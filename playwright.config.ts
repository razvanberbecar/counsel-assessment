import { defineConfig, devices } from '@playwright/test';
// E2E_PORT lets two checkouts run the browser tests side by side.
const port = Number(process.env.E2E_PORT ?? 5177);
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // In CI, also emit failures as GitHub annotations.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
});
