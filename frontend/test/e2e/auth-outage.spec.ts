import { test, expect } from './fixtures';
test('startup outage sends one refresh and preserves session hint', async ({ page }) => {
  let refreshes = 0;
  await page.addInitScript(() => localStorage.setItem('mss-locker-session', 'active'));
  await page.route('**/api/auth/refresh', route => { refreshes++; return route.fulfill({ status: 503, json: { success: false, message: 'API server unavailable' } }); });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  expect(refreshes).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('mss-locker-session'))).toBe('active');
});
test('login shows server outage message instead of invalid credentials', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 503, json: { success: false, message: 'API server is unavailable. Start the backend and check its configured port.' } }));
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('test-user');
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByText('API server is unavailable. Start the backend and check its configured port.', { exact: true })).toBeVisible();
});
