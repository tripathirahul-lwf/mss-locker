import { test, expect } from '@playwright/test';

async function openAudit(page: any) {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Audit Log', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Security & Audit Logs', exact: true })).toBeVisible();
  await page.getByLabel('Search audit events', { exact: true }).fill('AUDIT-FIXTURE');
}

test('audit counts, category/severity filters, exports and Inspect use the full matching history', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openAudit(page);
  const total = page.getByRole('button', { name: /Total Audited Events/ });
  const signIns = page.getByRole('button', { name: /Successful Sign-ins/ });
  await expect(total).toContainText('33');
  await expect(signIns).toContainText('30');
  await page.getByLabel('Audit page size').selectOption('15');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(16);
  await page.getByRole('button', { name: 'Next audit page', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Audit pagination' })).toContainText('Page 2 of 3');
  await expect(signIns).toContainText('30');
  await page.getByRole('button', { name: 'Timeline Stream', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Inspect Details', exact: true })).toHaveCount(15);
  await page.getByRole('button', { name: 'Previous audit page', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Audit pagination' })).toContainText('Page 1 of 3');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered events', exact: true }).click();
  await page.getByRole('button', { name: 'Export as JSON', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  expect(exported.logs).toHaveLength(33);
  expect(JSON.stringify(exported)).not.toContain('fixture-private-secret');
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await page.getByRole('button', { name: 'Billing & Payments', exact: true }).click();
  await expect(total).toContainText('2');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
  const payment = page.getByRole('row').filter({ hasText: 'AUDIT-FIXTURE payment' });
  await expect(payment).toContainText('Test Admin');
  await payment.getByRole('button', { name: 'Inspect', exact: true }).click();
  const inspector = page.getByRole('dialog', { name: 'Audit event details', exact: true });
  await expect(inspector.getByText('AUDIT-RCP-42', { exact: true })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(inspector.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(payment.getByRole('button', { name: 'Inspect', exact: true })).toBeFocused();
  const approval = page.getByRole('row').filter({ hasText: 'AUDIT-FIXTURE refund approved' });
  await approval.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(inspector.getByText('Approval reserves the refund. No payout is confirmed by this event.', { exact: true })).toBeVisible();
  await expect(inspector.getByText(/Settlement Complete/)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'All Events', exact: true }).click();
  await page.getByLabel('Audit severity').selectOption('WARNING');
  await expect(total).toContainText('1');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('table')).toContainText('KYC removed');
  expect(errors).toEqual([]);
});

test('audit failures show retry and auto-refresh updates the current filter without navigation', async ({ page }) => {
  let fail = true;
  await page.route('**/api/audit-logs?**', async route => {
    if (fail) await route.fulfill({ status: 503, json: { success: false, message: 'Temporary audit failure' } });
    else await route.continue();
  });
  await openAudit(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load audit events' })).toBeVisible();
  await expect(page.getByText('No audit records found', { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry audit logs', exact: true }).click();
  await expect(page.getByRole('button', { name: /Total Audited Events/ })).toContainText('33');
  const url = page.url();
  await page.getByRole('button', { name: 'Auto-refresh Off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Auto-refresh On (10s)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const refreshed = await page.waitForResponse(response => response.url().includes('/api/audit-logs?') && response.url().includes('AUDIT-FIXTURE'), { timeout: 15000 });
  expect(refreshed.status()).toBe(200);
  expect(page.url()).toBe(url);
});
