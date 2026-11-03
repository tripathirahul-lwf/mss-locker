import { test, expect } from './fixtures';
async function login(page: any) {
  await page.goto('/login'); await page.getByLabel('Username or Email').fill('browser-test'); await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!'); await page.getByRole('button', { name: /Sign In/i }).click(); await page.waitForURL(url => url.pathname === '/');
}
async function openClose(page: any) {
  await login(page); await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  const locker = page.getByRole('dialog', { name: 'Locker #77', exact: true }); await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Close Locker 77', exact: true }); await expect(modal).toBeVisible(); return { modal, locker };
}
test('direct close records the refund date and releases the locker without a review popup', async ({ page }) => {
  const { modal } = await openClose(page);
  await expect(modal.getByLabel('Refund status', { exact: true })).toHaveCount(0);
  await expect(modal.getByLabel('Refunded date', { exact: true })).toBeEnabled();
  await expect(modal.getByLabel('Refunded date', { exact: true })).toHaveAttribute('type', 'date');
  await expect(modal.getByRole('button', { name: 'Open refunded date calendar', exact: true })).toBeVisible();
  await expect(modal.getByLabel('Deposit refund (INR)', { exact: true })).toHaveValue('6000.00');
  await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
  await modal.getByRole('checkbox').check();
  const result = page.waitForResponse(r => r.url().endsWith('/api/closures/direct') && r.request().method() === 'POST');
  await modal.getByRole('button', { name: 'Confirm close', exact: true }).click();
  const response = await result; expect(response.status()).toBe(200);
  const record = (await response.json()).data; expect(record.status).toBe('COMPLETED'); expect(record.refundedDate).toBeTruthy(); expect(record.financialSnapshot.depositRefunded).toBe(6000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open locker 77', exact: true })).toContainText('Vacant');
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('direct close keeps failed requests in the form and validates refund dates', async ({ page }) => {
  await page.route('**/api/closures/direct', route => route.fulfill({ status: 409, json: { message: 'Refund balance changed. Reload the closure details.' } }));
  const { modal } = await openClose(page); await modal.getByRole('checkbox').check();
  await modal.getByLabel('Refunded date', { exact: true }).fill('2099-01-01');
  await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
  await modal.getByLabel('Refunded date', { exact: true }).fill(await modal.getByLabel('Closing date', { exact: true }).inputValue());
  await modal.getByRole('button', { name: 'Confirm close', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Refund balance changed');
  await expect(page.getByRole('dialog')).toHaveCount(2);
});

test('Closed filter stays in dashboard and displays historical customer records with size/search and snapshot modal', async ({ page }, testInfo) => {
  const id = '000000000000000000001234'; let failed = true;
  const record = { _id: id, closureNumber: 'CLS-HISTORY-77', status: 'COMPLETED', closureType: 'CUSTOMER_REQUEST', closureReason: 'Customer no longer needs locker', actualClosureDate: '2026-10-01', requestedClosureDate: '2026-10-01', requestedBy: { name: 'Counter operator' }, allocationId: { _id: '000000000000000000001235', allocationCode: 'ALC-HISTORY-77', startDate: '2020-01-01', annualRent: 1180, securityDeposit: 6000 }, lockerId: { _id: '000000000000000000001236', lockerNumber: '77', size: 'A', rackNumber: 'Rack 7', status: 'OCCUPIED' }, customerId: { _id: '000000000000000000001237', fullName: 'Previous Customer', customerCode: 'HISTORICAL-77', phone: '9823507801' }, physicalChecklist: { lockerEmptied: true, lockerInspected: true, customerKeyReturned: true, documentsReturned: true, physicalAccessRevoked: true }, financialSnapshot: { outstandingAtClosure: 0, depositRefunded: 6000, depositBalanceAtClosure: 0 } };
  await page.route(/\/api\/closures\?/, async route => {
    const url = new URL(route.request().url()); if (url.searchParams.get('status') !== 'COMPLETED') return route.continue();
    if (failed) return route.fulfill({ status: 503, json: { message: 'Closed history unavailable' } });
    const rows = url.searchParams.get('search') === 'missing' || url.searchParams.get('size') === 'B' ? [] : [record];
    await route.fulfill({ json: { success: true, data: rows, pagination: { page: 1, total: rows.length, totalPages: 1, limit: 12 } } });
  });
  await page.route(`**/api/closures/${id}`, route => route.fulfill({ json: { success: true, data: record } }));
  await login(page); const path = new URL(page.url()).pathname;
  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  const region = page.getByRole('region', { name: 'Closed locker records' }); await expect(region.getByRole('alert')).toContainText('Could not load');
  failed = false; await region.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(region).toContainText('Previous Customer'); await expect(region).not.toContainText('Reference Customer');
  expect(new URL(page.url()).pathname).toBe(path);
  await region.getByRole('button', { name: 'View closed record', exact: true }).click(); const modal = page.getByRole('dialog', { name: 'CLS-HISTORY-77', exact: true }); await expect(modal).toBeVisible();
  await expect(modal.getByRole('region', { name: 'Closure financial snapshot' })).toContainText('6,000.00');
  await expect(modal.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.screenshot({ path: testInfo.outputPath('completed-closure.png') });
  await page.keyboard.press('Escape');
  await expect(region.getByRole('button', { name: 'View closed record', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByLabel('Search locker #, rack, or tenant', { exact: true }).fill('missing'); await expect(region).toContainText('No closed locker records match');
  await page.getByLabel('Search locker #, rack, or tenant', { exact: true }).fill(''); await expect(region).toContainText('Previous Customer');
  await page.getByRole('combobox').first().selectOption('B'); await expect(region).toContainText('No closed locker records match');
  await page.getByRole('combobox').first().selectOption('A'); await expect(region).toContainText('Previous Customer');
  await page.reload(); await expect(region).toContainText('Previous Customer'); expect(new URL(page.url()).pathname).toBe(path);
  await page.getByRole('button', { name: 'All', exact: true }).click(); await expect(region).toHaveCount(0); await expect(page.getByRole('button', { name: 'Open locker 77', exact: true })).toBeVisible();
});

test('missing collection is explicit and inconsistent settlement cannot be submitted', async ({ page }) => {
  let invalid = false;
  await page.route('**/api/closures/*/readiness', async route => {
    const response = await route.fetch(); const body = await response.json();
    Object.assign(body.data, { depositCollected: 0, depositCredits: 0, totalRefunded: 0, totalDeductions: 0, netDepositHeld: 0, pendingRefundAmount: 0, availableRefundableBalance: 0 });
    if (invalid) body.data.allocationId = '000000000000000000000000';
    await route.fulfill({ response, json: body });
  });
  const { modal, locker } = await openClose(page);
  await expect(modal.getByLabel('Refunded date', { exact: true })).toHaveAttribute('type', 'date');
  await expect(modal.getByRole('button', { name: 'Open refunded date calendar', exact: true })).toBeEnabled();
  await modal.getByRole('button', { name: 'Back', exact: true }).click(); invalid = true;
  await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Settlement data needs review');
  await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
});

test('interrupted direct close recovers only a completed closure without opening review', async ({ page }) => {
  let count = 0;
  await page.route('**/api/closures/direct', async route => {
    count++; const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort('failed');
  });
  const { modal } = await openClose(page); await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Confirm close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(count).toBe(1);
});


test('closed record handles missing history and statement failures without showing false settlement', async ({ page }) => {
  const id = '000000000000000000009999';
  const record = { _id: id, closureNumber: 'CLS-INCOMPLETE', status: 'COMPLETED', customerId: null, lockerId: null, allocationId: null, physicalChecklist: {}, requestedAt: 'invalid', requestedClosureDate: 'invalid' };
  await page.route(/\/api\/closures\?/, route => route.fulfill({ json: { success: true, data: [record], pagination: { total: 1, page: 1, totalPages: 1, limit: 12 } } }));
  await page.route(`**/api/closures/${id}`, route => route.fulfill({ json: { success: true, data: record } }));
  await page.route(`**/api/closures/${id}/statement-html*`, route => route.fulfill({ status: 503, json: { message: 'Statement unavailable' } }));
  await login(page); await page.getByRole('button', { name: 'Closed', exact: true }).click();
  await page.getByRole('button', { name: 'View closed record', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'CLS-INCOMPLETE', exact: true });
  await expect(modal).toContainText('No historical settlement snapshot recorded');
  await expect(modal).not.toContainText('Invalid Date');
  await expect(modal).not.toContainText('\u20b90');
  await modal.getByRole('button', { name: 'Close closure details', exact: true }).focus();
  await page.keyboard.press('Shift+Tab'); await expect(modal.getByRole('button', { name: 'Print Statement', exact: true })).toBeFocused();
  await modal.getByRole('button', { name: 'Print Statement', exact: true }).click();
  const statement = page.getByRole('dialog', { name: 'Closure statement', exact: true });
  await expect(statement).toBeVisible();
  await statement.getByRole('button', { name: 'Print Statement', exact: true }).click();
  await expect(statement.getByRole('alert')).toContainText('Could not load the official statement');
  await page.keyboard.press('Escape'); await expect(statement).toHaveCount(0); await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});
