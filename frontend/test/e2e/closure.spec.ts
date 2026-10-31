import { test, expect } from './fixtures';
async function login(page: any) {
  await page.goto('/login'); await page.getByLabel('Username or Email').fill('browser-test'); await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!'); await page.getByRole('button', { name: /Sign In/i }).click(); await page.waitForURL(url => url.pathname === '/');
}
async function openClose(page: any) {
  await login(page); await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  const locker = page.getByRole('dialog', { name: 'Locker #77', exact: true }); await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Close Locker 77', exact: true }); await expect(modal).toBeVisible(); return { modal, locker };
}
test('close locker reference form uses actual refund status and validates handover with same-page recovery', async ({ page }, testInfo) => {
  let count = 0;
  await page.route(/\/api\/closures$/, async route => { if (route.request().method() !== 'POST') return route.continue(); count++; await new Promise(resolve => setTimeout(resolve, 350)); await route.fulfill({ status: 409, json: { message: 'An open closure workflow already exists.' } }); });
  const { modal, locker } = await openClose(page); const url = page.url();
  await expect(modal).toContainText('Reference Customer');
  await expect(modal.getByLabel('Deposit refund (INR)', { exact: true })).toHaveValue('6000.00');
  await expect(modal.getByLabel('Deposit refund (INR)', { exact: true })).toHaveJSProperty('readOnly', true);
  await expect(modal.getByLabel('Refund status', { exact: true })).toHaveValue('Refund or settlement pending');
  await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
  await modal.getByRole('checkbox').check(); await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeEnabled();
  await modal.getByLabel('Closing date', { exact: true }).fill('2099-01-01'); await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
  await modal.getByLabel('Closing date', { exact: true }).fill(await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())));
  await modal.getByLabel('Reason / notes (optional)', { exact: true }).pressSequentially('Customer closing locker');
  await page.screenshot({ path: testInfo.outputPath('close-reference.png') });
  await modal.getByRole('button', { name: 'Confirm close', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Submitting...', exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
  await expect(modal.getByRole('alert')).toContainText('already exists'); expect(count).toBe(1);
  await modal.getByRole('button', { name: 'Back', exact: true }).click(); await expect(locker).toBeVisible(); expect(page.url()).toBe(url);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('close request submits once for review without marking held deposit refunded or releasing locker', async ({ page }) => {
  const { modal, locker } = await openClose(page); const url = page.url(); let id = '', auth = '';
  page.on('request', req => { if (req.url().endsWith('/api/closures') && req.method() === 'POST') auth = req.headers()['authorization'] || ''; });
  try {
    await modal.getByRole('checkbox').check(); const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/closures') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Confirm close', exact: true }).click(); const response = await responsePromise; expect(response.status()).toBe(201);
    const record = (await response.json()).data; id = record._id; expect(record.status).toBe('PENDING_REVIEW'); expect(record.actualClosureDate).toBeUndefined();
    await expect(page.getByRole('dialog', { name: record.closureNumber, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Closure', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(locker).toBeVisible(); expect(page.url()).toBe(url);
  } finally { if (id) { const response = await page.request.post(`/api/closures/${id}/cancel`, { headers: { Authorization: auth, Origin: new URL(page.url()).origin }, data: { reason: 'Browser cleanup of closure request' } }); expect(response.ok(), await response.text()).toBeTruthy(); } }
});
test('Closed filter stays in dashboard and displays historical customer records with size/search and snapshot modal', async ({ page }) => {
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
  await expect(modal.getByRole('region', { name: 'Closure financial snapshot' })).toContainText('6,000.00'); await page.keyboard.press('Escape');
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
  await expect(modal.getByLabel('Refund status', { exact: true })).toHaveValue('No deposit collection recorded');
  await modal.getByRole('button', { name: 'Back', exact: true }).click(); invalid = true;
  await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Settlement data needs review');
  await expect(modal.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
});

test('interrupted create resumes the saved request and accepts short optional notes', async ({ page }) => {
  let id = '', auth = '', count = 0;
  await page.route(/\/api\/closures$/, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    count++; auth = route.request().headers()['authorization'] || '';
    const response = await route.fetch(); expect(response.status()).toBe(201);
    const record = (await response.json()).data; id = record._id;
    expect(record.notes).toBe('ok'); await route.abort('failed');
  });
  try {
    const { modal } = await openClose(page);
    await modal.getByLabel('Reason / notes (optional)', { exact: true }).fill('ok');
    await modal.getByRole('checkbox').check();
    await modal.getByRole('button', { name: 'Confirm close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancel Request', exact: true })).toBeVisible();
    expect(count).toBe(1); await expect(modal).toHaveCount(0);
  } finally {
    if (id) { const response = await page.request.post(`/api/closures/${id}/cancel`, { headers: { Authorization: auth, Origin: new URL(page.url()).origin }, data: { reason: 'Browser cleanup of interrupted closure request' } }); expect(response.ok(), await response.text()).toBeTruthy(); }
  }
});
