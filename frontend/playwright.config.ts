import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/e2e', fullyParallel: false, workers: 1, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:25173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: [
    { command: 'node ../backend/node_modules/tsx/dist/cli.mjs ../backend/test/e2e-server.ts', url: 'http://127.0.0.1:25099/health', timeout: 120000, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 25173 --strictPort', url: 'http://127.0.0.1:25173', timeout: 60000, env: { VITE_API_BASE_URL: '/api', VITE_API_PROXY_TARGET: 'http://127.0.0.1:25099' }, reuseExistingServer: false },
  ],
});
