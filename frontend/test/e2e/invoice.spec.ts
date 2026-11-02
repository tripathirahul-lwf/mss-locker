import { test, expect } from './fixtures';
async function openInvoice(page: any) {
  await page.goto('/login'); await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!'); await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  const locker = page.getByRole('dialog', { name: 'Locker #77', exact: true });
  await locker.getByRole('button', { name: /^View invoice/ }).first().click();
  const modal = page.getByRole('dialog', { name: /^Invoice INV/ }); await expect(modal).toBeVisible();
  await expect(modal.getByText('Loading invoice details...', { exact: true })).toHaveCount(0);
  return { modal, locker };
}
test('invoice uses recorded zero GST and same-page profile/matrix with contained keyboard focus', async ({ page }) => {
  await page.route(/\/api\/renewals\/[a-f0-9]{24}$/, async route => {
    const response = await route.fetch(); const body = await response.json(); Object.assign(body.data, { invoiceType: 'LEGACY_IMPORT', baseRent: 1180, taxAmount: 0, otherCharges: 0, lateFee: 0, discount: 0, totalAmount: 1180, paidAmount: 1180, balanceAmount: 0 });
    await route.fulfill({ response, json: body });
  });
  const { modal } = await openInvoice(page); const url = page.url();
  await expect(modal.getByText('Rent amount (as recorded)').locator('..')).toContainText('1,180.00');
  await expect(modal.getByText(/GST 18%/)).toHaveCount(0); await expect(modal).not.toContainText('SAC 997212');
  await modal.getByRole('button', { name: 'Profile', exact: true }).click();
  const profile = page.getByRole('dialog', { name: 'Customer Profile', exact: true }); await expect(profile).toBeVisible();
  await profile.getByRole('button', { name: 'Edit customer', exact: true }).click();
  const form = page.getByRole('dialog', { name: /Edit Customer/ }); await expect(form).toBeVisible();
  await form.locator('#customer-email').click(); await page.keyboard.press('Escape'); await expect(profile).toBeVisible();
  await page.keyboard.press('Escape'); await expect(profile).toHaveCount(0); await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Matrix', exact: true }).click();
  const matrix = page.getByRole('dialog', { name: 'Locker location', exact: true }); await expect(matrix).toBeVisible();
  await expect(matrix.getByText('77', { exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(matrix).toHaveCount(0);
  await modal.focus(); await page.keyboard.press('Shift+Tab'); await expect(modal.getByRole('button', { name: 'Print Invoice', exact: true })).toBeFocused();
  expect(page.url()).toBe(url);
});

test('invoice period edits persist matching coverage and stale saves remain editable with a visible error', async ({ page }) => {
  const { modal } = await openInvoice(page);
  await modal.getByRole('button', { name: 'Edit Period', exact: true }).click();
  const end = await modal.getByLabel('Period end date', { exact: true }).inputValue(); const changed = new Date(end + 'T00:00:00Z'); changed.setUTCDate(changed.getUTCDate() + 3);
  const nextEnd = changed.toISOString().slice(0, 10); await modal.getByLabel('Period end date').fill(nextEnd);
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/billing-period') && response.request().method() === 'PATCH');
  await modal.getByRole('button', { name: 'Save Period', exact: true }).click(); const response = await responsePromise; expect(response.ok()).toBeTruthy();
  const updated = (await response.json()).data; expect(updated.billingPeriodEnd.slice(0, 10)).toBe(nextEnd);
  await expect(modal.getByText('Billing period updated successfully', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Edit Period', exact: true }).click(); await expect(modal.getByLabel('Period end date')).toHaveValue(nextEnd);
  await page.route('**/api/renewals/*/billing-period', route => route.fulfill({ status: 409, json: { message: 'Invoice changed. Reload it before editing the period.' } }));
  await modal.getByRole('button', { name: 'Save Period', exact: true }).click(); await expect(modal.getByRole('alert')).toContainText('Invoice changed');
  await expect(modal.getByLabel('Period end date')).toBeEnabled();
});

test('invoice refresh, receipt and print errors are visible and cancelled bills never claim settlement', async ({ page }) => {
  let refreshFailed = true;
  await page.route(/\/api\/renewals\/[a-f0-9]{24}$/, async route => {
    if (refreshFailed) await route.fulfill({ status: 503, json: { message: 'Invoice unavailable' } });
    else { const response = await route.fetch(); const body = await response.json(); body.data.status = 'CANCELLED'; await route.fulfill({ response, json: body }); }
  });
  await page.route('**/api/payments/invoice/*', route => route.fulfill({ status: 503, json: { message: 'Payments unavailable' } }));
  await page.route('**/api/renewals/*/html*', route => route.fulfill({ status: 503, json: { message: 'Print unavailable' } }));
  const { modal } = await openInvoice(page);
  await expect(modal.getByText('Could not refresh invoice.', { exact: false })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Edit Period', exact: true })).toHaveCount(0);
  refreshFailed = false; await modal.getByRole('button', { name: 'Retry invoice', exact: true }).click();
  await expect(modal.getByText('CANCELLED', { exact: true })).toBeVisible(); await expect(modal.getByText('Settled in Full', { exact: true })).toHaveCount(0);
  await expect(modal.getByText('Could not load payment receipts.', { exact: false })).toBeVisible();
  await modal.getByRole('button', { name: 'Print Invoice', exact: true }).click(); await expect(modal.getByText('Could not print invoice. Please retry.', { exact: true })).toBeVisible();
});


test('invoice cancellation uses a top-layer confirmation and reports rejected settlement safely', async ({ page }) => {
  await page.route(/\/api\/renewals\/[a-f0-9]{24}$/, async route => {
    const response = await route.fetch(); const body = await response.json(); Object.assign(body.data, { paidAmount: 0, balanceAmount: body.data.totalAmount, paymentStatus: 'UNPAID', status: 'ISSUED' }); await route.fulfill({ response, json: body });
  });
  const { modal } = await openInvoice(page);
  await modal.getByRole('button', { name: 'Cancel Invoice', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: /^Cancel Invoice/ }); await expect(confirmation).toBeVisible();
  await confirmation.getByLabel('Cancellation reason', { exact: true }).pressSequentially('Duplicate bill review');
  await expect(confirmation.getByLabel('Cancellation reason', { exact: true })).toHaveValue('Duplicate bill review');
  await confirmation.getByRole('button', { name: 'Confirm Cancellation', exact: true }).click();
  await expect(confirmation.getByRole('alert')).toContainText('Cannot cancel an invoice with recorded payments');
  await page.keyboard.press('Escape'); await expect(confirmation).toBeHidden(); await expect(modal).toBeVisible();
});


test('invoice prints in place and malformed balances remain reviewable without crashing', async ({ page }) => {
  await page.route('**/api/renewals/*/html*', async route => {
    const response = await route.fetch(); const html = await response.text();
    expect(html).not.toContain('upi://');
    await route.fulfill({ response, body: html.replace('</head>', '<script>window.print=()=>{window.parent.__invoicePrintCalls=(window.parent.__invoicePrintCalls||0)+1;window.parent.__invoicePrintText=document.body.innerText;window.dispatchEvent(new Event("afterprint"));};</script></head>') });
  });
  const { modal } = await openInvoice(page); const url = page.url(); let popups = 0; page.on('popup', () => popups++);
  await modal.getByRole('button', { name: 'Print Invoice', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__invoicePrintCalls)).toBe(1);
  expect(await page.evaluate(() => (window as any).__invoicePrintText)).toContain('Recorded invoice breakdown');
  expect(page.url()).toBe(url); expect(popups).toBe(0);
  await page.route(/\/api\/renewals\/[a-f0-9]{24}$/, async route => {
    const response = await route.fetch(); const body = await response.json(); delete body.data.balanceAmount; body.data.paymentStatus = 'UNKNOWN'; await route.fulfill({ response, json: body });
  });
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  await page.getByRole('dialog', { name: 'Locker #77', exact: true }).getByRole('button', { name: /^View invoice/ }).first().click();
  await expect(modal.getByText('Billing needs review', { exact: true })).toBeVisible();
  await expect(modal.getByText('Not recorded', { exact: true }).first()).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Record Payment', exact: true })).toHaveCount(0);
});
