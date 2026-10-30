import { test, expect } from '@playwright/test';
async function openOccupied(page: any) {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  return page.getByRole('dialog', { name: 'Locker #77', exact: true });
}
test('occupied reference layout shows real rent, held deposit, masked ID and separate receipts on the same page', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const modal = await openOccupied(page); const url = page.url();
  const summary = modal.getByTestId('occupied-locker-summary');
  await expect(modal.getByLabel('Payment and renewal status')).toHaveText('All good');
  await expect(modal).toContainText('Size A'); await expect(modal).toContainText('Rack 7'); await expect(modal).toContainText('Key K-1007');
  await expect(summary.getByText('Customer', { exact: true }).locator('..')).toContainText('Reference Customer');
  await expect(summary.getByText('Annual rent (+18% GST)', { exact: true }).locator('..')).toContainText('3,000.00');
  await expect(summary.getByText('Annual rent (+18% GST)', { exact: true }).locator('..')).toContainText('3,540.00');
  await expect(summary.getByText('Security deposit', { exact: true }).locator('..')).toContainText('6,000.00');
  await expect(summary).not.toContainText('704724216043');
  await summary.getByRole('button', { name: 'Show ID number', exact: true }).click();
  await expect(summary).toContainText('704724216043');
  await summary.getByRole('button', { name: 'Hide ID number', exact: true }).click();
  const history = modal.getByRole('region', { name: 'Bill and receipt history' });
  await expect(history.getByRole('button', { name: 'View receipt REFERENCE-77', exact: true })).toBeVisible();
  await expect(history.getByRole('button', { name: 'View receipt REFERENCE-77-DEP', exact: true })).toBeVisible();
  await expect(history).toContainText('3,590.00'); await expect(history).toContainText('6,000.00');
  await page.screenshot({ path: testInfo.outputPath('occupied-reference.png'), fullPage: false });
  await history.getByRole('button', { name: 'View receipt REFERENCE-77', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Payment receipt REFERENCE-77', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
  await summary.getByRole('button', { name: 'KYC Compliance - KYC & ID documents', exact: true }).click();
  await expect(modal.getByRole('region', { name: 'Locker KYC documents' })).toBeVisible();
  await modal.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(summary).toBeVisible();
  await page.setViewportSize({ width: 844, height: 450 });
  await expect(modal.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(page.url()).toBe(url); expect(errors).toEqual([]);
});

test('occupied summary does not show a healthy state on failed billing or another tenancy receipt', async ({ page }) => {
  let fail = true;
  await page.route('**/api/renewals/locker/*', async route => {
    if (fail) { await route.fulfill({ status: 503, json: { success: false, message: 'Billing unavailable' } }); return; }
    const response = await route.fetch(); const body = await response.json();
    const invoices = body.data;
    if (Array.isArray(invoices) && invoices[0]) invoices.push({ ...invoices[0], _id: '000000000000000000000077', invoiceNumber: 'OTHER-TENANCY-BILL', allocationId: '000000000000000000000078' });
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/payments/locker/*', async route => {
    const response = await route.fetch(); const body = await response.json();
    if (Array.isArray(body.data) && body.data[0]) body.data.push({ ...body.data[0], _id: '000000000000000000000079', allocationId: '000000000000000000000078', invoiceId: '000000000000000000000077', receiptNumber: 'OTHER-TENANCY-RECEIPT' });
    await route.fulfill({ response, json: body });
  });
  const modal = await openOccupied(page);
  await expect(modal.getByLabel('Payment and renewal status')).toHaveText('Status unavailable');
  await expect(modal.getByText('Could not load invoices.', { exact: false })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Renew Lease', exact: true })).toHaveCount(0);
  fail = false; await modal.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(modal.getByLabel('Payment and renewal status')).toHaveText('All good');
  await expect(modal.getByTestId('occupied-locker-summary')).not.toContainText('OTHER-TENANCY');
});


test('generic attachment labels are not shown as IDs and zero deposit explains missing collection', async ({ page }) => {
  await page.route('**/api/customers/*/kyc', async route => {
    const response = await route.fetch(); const body = await response.json();
    if (body.data?.[0]) { body.data[0].documentNumber = 'KYC Document'; body.data[0].maskedDocumentNumber = '****ment'; body.data[0].documentType = 'OTHER'; }
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/deposits/allocation/*/summary', async route => {
    const response = await route.fetch(); const body = await response.json();
    Object.assign(body.data, { totalDepositReceived: 0, netDepositHeld: 0, requiredDeposit: 6000 });
    await route.fulfill({ response, json: body });
  });
  const modal = await openOccupied(page); const summary = modal.getByTestId('occupied-locker-summary');
  await expect(summary.getByText('ID', { exact: true }).locator('..')).toContainText('Documents on file');
  await expect(summary).not.toContainText('****ment');
  await expect(summary.getByRole('button', { name: 'Show ID number', exact: true })).toHaveCount(0);
  await expect(summary.getByText('Security deposit', { exact: true }).locator('..')).toContainText('No collection recorded. Required:');
  await expect(summary.getByText('Security deposit', { exact: true }).locator('..')).toContainText('6,000.00');
  await expect(summary.getByRole('heading', { name: /Bill & receipt history/ })).toContainText('1 bill, 2 receipts');
});

test('old coverage and contradictory paid balances require review instead of renewal', async ({ page }) => {
  await page.route('**/api/lockers/*/allocations', async route => {
    const response = await route.fetch(); const body = await response.json();
    if (body.data?.currentAllocation) { body.data.currentAllocation.paymentCoverageConfirmed = true; body.data.currentAllocation.paidThroughDate = '2020-01-01'; }
    await route.fulfill({ response, json: body });
  });
  const modal = await openOccupied(page);
  await expect(modal.getByLabel('Payment and renewal status')).toHaveText('Payment needs review');
  await expect(modal.getByRole('button', { name: 'Renew Lease', exact: true })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await page.route('**/api/renewals/locker/*', async route => {
    const response = await route.fetch(); const body = await response.json();
    if (body.data?.[0]) { body.data[0].balanceAmount = 100; body.data[0].paymentStatus = 'PAID'; }
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  await expect(modal.getByLabel('Payment and renewal status')).toHaveText('Billing needs review');
  await expect(modal.getByRole('button', { name: 'Renew Lease', exact: true })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: /^Record Payment/ })).toHaveCount(0);
});

test('receipt requests can be switched and closing the locker cancels an unfinished preview', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/api\/payments\/[a-f0-9]{24}$/, async route => { await gate; if (!route.request().failure()) await route.continue().catch(() => {}); });
  const modal = await openOccupied(page);
  const rent = modal.getByRole('button', { name: 'View receipt REFERENCE-77', exact: true });
  const deposit = modal.getByRole('button', { name: 'View receipt REFERENCE-77-DEP', exact: true });
  await rent.click();
  await expect(rent).toHaveAttribute('aria-busy', 'true');
  await expect(deposit).toBeEnabled();
  await deposit.click();
  await expect(deposit).toHaveAttribute('aria-busy', 'true');
  await expect(rent).toBeEnabled();
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  release();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('dialog', { name: /^Payment receipt/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'View receipt REFERENCE-77-DEP', exact: true })).toBeEnabled();
});
