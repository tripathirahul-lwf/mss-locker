import { test, expect } from './fixtures';
const renderWarnings = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const warnings: string[] = [];
  renderWarnings.set(page, warnings);
  page.on('console', message => {
    if (/Cannot update a component|while rendering a different component/.test(message.text())) warnings.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(renderWarnings.get(page) || []).toEqual([]);
});
const fixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT9kAAAAASUVORK5CYII=', 'base64');
test('sign in, allot with documents and receipt, filter and reopen KYC', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByRole('region', { name: 'Vault overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Vacant', exact: false }).first().click();
  const unit = testInfo.project.name === 'mobile' ? '2' : '1';
  await page.getByRole('button', { name: `Open locker ${unit}`, exact: true }).click();
  const modal = page.getByRole('dialog', { name: /New Allotment/ });
  await expect(modal).toBeVisible();
  await modal.getByLabel('New customer name').fill(`Browser Customer ${unit}`);
  await modal.getByLabel('Phone', { exact: true }).fill(`987654000${unit}`);
  await modal.getByLabel('Key number').fill(`TEST-KEY-${unit}`);
  await modal.getByLabel('Tenure', { exact: true }).selectOption('3');
  await modal.getByLabel('Opening date').fill('2026-10-30');
  await expect(modal.getByText('\u20b95,590.00', { exact: true })).toBeVisible();
  await modal.getByLabel('Receipt number', { exact: true }).fill(`BROWSER-${unit}`);
  await modal.getByLabel('ID number', { exact: true }).fill('ABCDE1234F');
  await modal.getByLabel('ID type', { exact: true }).selectOption('PAN');
  await modal.getByLabel('KYC photo', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: fixturePng });
  await modal.getByLabel('ID proof (image or PDF)', { exact: true }).setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: fixturePng });
  await modal.getByLabel('Receipt image or PDF (optional)', { exact: true }).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: fixturePng });
  await modal.getByRole('button', { name: 'Preview Receipt image or PDF (optional)', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'receipt.png Preview', exact: true }).getByRole('img', { name: 'receipt.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await modal.getByRole('button', { name: 'Preview KYC photo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'photo.png Preview', exact: true }).getByRole('img', { name: 'photo.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await modal.getByLabel('ID proof (image or PDF)', { exact: true }).setInputFiles({ name: 'id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF') });
  await modal.getByRole('button', { name: 'Preview ID proof (image or PDF)', exact: true }).click();
  await expect(page.locator('iframe[title="id.pdf"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await modal.getByRole('button', { name: 'Delete ID proof (image or PDF)', exact: true }).click();
  await expect(page.locator('iframe[title="id.pdf"]')).toHaveCount(0);
  await modal.getByLabel('ID proof (image or PDF)', { exact: true }).setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: fixturePng });

  await expect(modal.getByLabel('Next renewal', { exact: true })).toHaveValue('2029-10-30');
  await modal.getByRole('checkbox').check();
  await modal.getByLabel('Next renewal', { exact: true }).fill('2029-11-15');
  await expect(modal.getByRole('checkbox')).not.toBeChecked();
  await modal.getByRole('button', { name: 'Use tenure date', exact: true }).click();
  await expect(modal.getByLabel('Next renewal', { exact: true })).toHaveValue('2029-10-30');
  await modal.getByLabel('Next renewal', { exact: true }).fill('2029-11-15');
  await modal.getByRole('checkbox').check();
  await page.screenshot({ path: `test-results/form-${testInfo.project.name}.png`, fullPage: true });
  const savedResponse = page.waitForResponse(response => response.url().endsWith('/api/allocations/complete') && response.request().method() === 'POST');
  await modal.getByRole('button', { name: 'Collect & Allot Locker' }).click();
  const saved = (await (await savedResponse).json()).data;
  expect(saved.allocation.nextRenewalDueDate.slice(0, 10)).toBe('2029-11-15');
  expect(saved.invoice.billingPeriodEnd.slice(0, 10)).toBe('2029-11-14');
  await expect(page.getByRole('heading', { name: 'Allotment complete' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`Caution Deposit Receipt.*BROWSER-${unit}-DEP`) })).toBeVisible();
  await page.screenshot({ path: `test-results/allotment-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: new RegExp(`Rent Receipt.*BROWSER-${unit}`) }).click();
  const receiptDialog = page.getByRole('dialog', { name: `Payment receipt BROWSER-${unit}`, exact: true });
  await expect(receiptDialog).toBeVisible();
  await receiptDialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Allotment complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Done & Close', exact: true }).click();
  await page.getByRole('button', { name: /Total Lockers/ }).click();
  await expect(page.getByRole('button', { name: `Open locker ${unit}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Open locker ${unit}`, exact: true }).getByRole('button', { name: 'Upload KYC' }).click();
  const kyc = page.getByRole('region', { name: 'Locker KYC documents' });
  await expect(kyc).toBeVisible();
  const sameUrl = page.url();
  await expect(kyc.getByRole('button', { name: 'Preview', exact: true })).toHaveCount(1);
  await expect(kyc.getByText('Aadhaar Card', { exact: true })).toHaveCount(0);
  await kyc.getByRole('button', { name: 'Replace', exact: true }).first().click();
  await kyc.getByLabel('KYC document file', { exact: true }).setInputFiles({ name: 'replacement-id.png', mimeType: 'image/png', buffer: fixturePng });
  await expect(kyc.getByRole('status')).toContainText('KYC document updated successfully');
  await expect(kyc.getByText('replacement-id.png')).toBeVisible();
  await kyc.getByRole('button', { name: 'Add document', exact: true }).click();
  await kyc.getByLabel('KYC document file', { exact: true }).setInputFiles({ name: 'additional-id.png', mimeType: 'image/png', buffer: fixturePng });
  await expect(kyc.getByRole('status')).toContainText('KYC document uploaded successfully');
  await expect(kyc.getByRole('button', { name: 'Preview', exact: true })).toHaveCount(2);
  const added = kyc.getByRole('group').filter({ hasText: 'additional-id.png' });
  await added.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Delete KYC document?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText('additional-id.png')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).not.toBeVisible();
  await expect(kyc).toBeVisible();
  await added.getByRole('button', { name: 'Delete', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(added).toBeVisible();
  await added.getByRole('button', { name: 'Delete', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Delete document', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(kyc.getByRole('status')).toContainText('KYC document deleted successfully');
  await expect(kyc.getByRole('button', { name: 'Preview', exact: true })).toHaveCount(1);
  expect(page.url()).toBe(sameUrl);
  let releasePreview!: () => void;
  const previewGate = new Promise<void>(resolve => { releasePreview = resolve; });
  await page.route('**/api/upload/private/browser-fixture-*.png', async route => {
    await previewGate;
    await route.fulfill({ status: 200, contentType: 'image/png', body: fixturePng });
  });
  const previewButton = kyc.getByRole('button', { name: 'Preview', exact: true }).first();
  await previewButton.click();
  try {
    await expect(previewButton).toHaveAttribute('aria-busy', 'true');
    await expect(previewButton.locator('.animate-spin')).toHaveCount(1);
    const addButton = kyc.getByRole('button', { name: 'Add document', exact: true });
    await expect(addButton).toBeEnabled();
    await expect(addButton.locator('.animate-spin')).toHaveCount(0);
    await expect(kyc.getByRole('button', { name: 'Replace', exact: true }).first()).toBeEnabled();
  } finally { releasePreview(); }
  await expect(page.getByRole('button', { name: 'Close preview', exact: true })).toBeVisible();
  expect(page.url()).toBe(sameUrl);

  await page.screenshot({ path: `test-results/kyc-${testInfo.project.name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `test-results/ledger-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});


test('allotment validates before uploads and resets cash confirmation after charge changes', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  const unit = testInfo.project.name === 'mobile' ? '4' : '3';
  await page.getByRole('button', { name: `Open locker ${unit}`, exact: true }).click();
  const modal = page.getByRole('dialog', { name: /New Allotment/ });
  let uploads = 0, writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/upload/file')) uploads++; if (request.url().endsWith('/api/allocations/complete')) writes++; });
  await modal.getByLabel('New customer name').fill('    ');
  await modal.getByLabel('Phone', { exact: true }).fill(`987655000${unit}`);
  await modal.getByLabel('Key number').fill('AUDIT-KEY');
  await modal.getByLabel('Receipt number', { exact: true }).fill(`VALIDATE-${unit}`);
  await modal.getByRole('checkbox').check();
  await modal.getByLabel('Refundable security deposit').fill('2100');
  await expect(modal.getByRole('checkbox')).not.toBeChecked();
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Collect & Allot Locker' }).click();
  await expect(modal.getByRole('alert')).toContainText('customer name');
  expect(uploads).toBe(0); expect(writes).toBe(0);
  await modal.getByLabel('New customer name').fill('Validation Customer');
  await modal.getByLabel('ID type', { exact: true }).selectOption('PAN');
  await modal.getByLabel('ID number', { exact: true }).fill('BAD-ID');
  await modal.getByLabel('ID proof (image or PDF)', { exact: true }).setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: fixturePng });
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Collect & Allot Locker' }).click();
  await expect(modal.getByRole('alert')).toContainText('valid ID number');
  expect(uploads).toBe(0); expect(writes).toBe(0);
  await modal.getByLabel('KYC photo', { exact: true }).setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(modal.getByRole('alert').filter({ hasText: '5 MB' })).toBeVisible();
  await expect(modal.getByLabel('KYC photo', { exact: true })).toHaveValue('');
  expect(uploads).toBe(0);
  const footer = modal.locator('footer');
  await expect(footer.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  await footer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal).not.toBeVisible();
});

test('lost allotment response retries the frozen request without duplicate collection', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  const unit = testInfo.project.name === 'mobile' ? '6' : '5';
  await page.getByRole('button', { name: `Open locker ${unit}`, exact: true }).click();
  const modal = page.getByRole('dialog', { name: /New Allotment/ });
  await modal.getByLabel('New customer name').fill('Network Retry Customer');
  await modal.getByLabel('Phone', { exact: true }).fill(`987655000${unit}`);
  await modal.getByLabel('Key number').fill(`RETRY-KEY-${unit}`);
  await modal.getByLabel('Receipt number', { exact: true }).fill(`RETRY-${unit}`);
  await modal.getByRole('checkbox').check();
  const bodies: string[] = [];
  await page.route('**/api/allocations/complete', async route => {
    bodies.push(route.request().postData()!);
    if (bodies.length === 1) { const saved = await route.fetch(); expect(saved.status()).toBe(201); await route.abort('failed'); }
    else await route.continue();
  });
  await modal.getByRole('button', { name: 'Collect & Allot Locker' }).click();
  await expect(modal.getByRole('alert')).toContainText('do not collect cash again');
  await expect(modal.getByLabel('Key number')).toBeDisabled();
  await modal.getByRole('button', { name: 'Check & Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Allotment complete' })).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
  const input = JSON.parse(bodies[0]);
  const response = await page.request.get(`/api/allocations?lockerId=${input.lockerId}`);
  expect(response.status()).toBe(200);
  expect((await response.json()).data.allocations).toHaveLength(1);
  await page.getByRole('button', { name: 'Done & Close', exact: true }).click();
});


test('allotment header and actions stay accessible on a short screen', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 8', exact: true }).click();
  const modal = page.getByRole('dialog', { name: /New Allotment/ });
  await expect(modal.getByRole('button', { name: 'Close allotment' })).toBeInViewport();
  await expect(modal.getByRole('button', { name: 'Collect & Allot Locker' })).toBeInViewport();
  const scroller = modal.locator('.vault-allotment-body');
  expect(await scroller.evaluate(element => element.scrollHeight > element.clientHeight)).toBeTruthy();
  await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(modal.getByRole('button', { name: 'Close allotment' })).toBeInViewport();
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
});


test('opening debt is labelled correctly with no fabricated paid-through or deposit', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 123', exact: true }).press('Enter');
  const modal = page.getByRole('dialog');
  await expect(modal.getByText(/Opening rent payment overdue/)).toBeVisible();
  await expect(modal.getByText('No confirmed rent payment for this period', { exact: true })).toBeVisible();
  await expect(modal.getByText(/Locker Renewal Overdue/)).toHaveCount(0);
  await expect(modal.getByText('Security deposit', { exact: true }).locator('..')).toContainText('0.00');
  await expect(modal.getByRole('button', { name: /^Invoices/ })).toBeVisible();
});


test('edit locker validates amounts, preserves full fields, confirms discard and saves catalogue changes', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 123', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dossier = page.getByRole('dialog', { name: 'Locker #123', exact: true });
  const form = page.getByRole('dialog', { name: 'Edit Locker #123', exact: true });
  await expect(form).toBeVisible();
  const save = form.getByRole('button', { name: 'Save Locker Changes', exact: true });
  await expect(save).toBeDisabled();
  await form.locator('#annual-rent').fill('-1');
  await save.click();
  await expect(form.getByRole('alert')).toContainText('required field');
  await form.locator('#annual-rent').fill('');
  await save.click();
  await expect(form.locator('#annual-rent')).toHaveAttribute('aria-invalid', 'true');
  const rate = testInfo.project.name === 'mobile' ? '1201.50' : '1200.50';
  await form.locator('#annual-rent').fill(rate);
  await form.locator('#grid-position').fill('Audit position');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  const discard = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
  await expect(discard).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(discard).not.toBeVisible();
  await expect(form).toBeVisible();
  await expect(form.locator('#occupancy-status')).toBeDisabled();
  await save.click();
  await expect(form).not.toBeVisible();
  await expect(dossier).toBeVisible();
  await dossier.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(form.locator('#grid-position')).toHaveValue('Audit position');
  await form.locator('#grid-position').fill('');
  await save.click();
  await expect(form).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});


test('locker tabs distinguish failed billing, legacy KYC, lease rates and recorded deposits', async ({ page }) => {
  let failInvoices = true;
  await page.route('**/api/lockers/*/allocations', async route => {
    const response = await route.fetch(); const body = await response.json();
    if (body.data?.currentAllocation) {
      body.data.currentAllocation.customerId.kycStatus = 'VERIFIED';
      body.data.currentAllocation.annualRent = 0;
      body.data.currentAllocation.rentSnapshot = 0;
    }
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/renewals/locker/*', async route => {
    if (failInvoices) await route.fulfill({ status: 503, json: { success: false, message: 'Temporary invoice failure' } });
    else await route.continue();
  });
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 123', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Locker #123' });
  await expect(modal.getByText('Annual rent (before GST)').locator('..')).toContainText('0.00');
  await modal.getByRole('button', { name: /Invoices/ }).click();
  await expect(modal.getByText('Could not load invoices.', { exact: false }).first()).toBeVisible();
  await expect(modal.getByText('No Invoices Recorded', { exact: true })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Renew Lease', exact: true })).toHaveCount(0);
  failInvoices = false;
  await modal.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(modal.getByRole('button', { name: /^View invoice/ }).first()).toBeVisible();
  await modal.getByRole('button', { name: /^View invoice/ }).first().click();
  await expect(page.getByRole('dialog', { name: /^Invoice INV/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /^Invoice INV/ })).toHaveCount(0);
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: /KYC Compliance/ }).click();
  await expect(page.getByRole('dialog', { name: 'KYC & ID documents', exact: true }).getByRole('region', { name: 'Locker KYC documents' }).getByRole('status')).toContainText('Legacy verification');
  await expect(page.getByRole('dialog', { name: 'KYC & ID documents', exact: true }).getByRole('region', { name: 'Locker KYC documents' }).getByRole('status')).toContainText('no digital KYC documents');
  await page.getByRole('dialog', { name: 'KYC & ID documents', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await modal.getByRole('button', { name: /Deposit & Refunds/ }).click();
  const depositPopup=page.getByRole('dialog',{name:'Deposit & Refunds',exact:true});
  await expect(depositPopup.getByText('Deposit collection pending', { exact: true })).toBeVisible();
  await expect(depositPopup.getByText(/Held in Bank Escrow/)).toHaveCount(0);
  await expect(depositPopup.getByText('Required deposit', { exact: true }).locator('..')).toContainText('2,000.00');
  await expect(depositPopup.getByText('Collected', { exact: true }).locator('..')).toContainText('0.00');
  await page.setViewportSize({ width: 844, height: 450 });
  await expect(depositPopup.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
});


test('customer profile, editing and closure stay on the locker page', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 123', exact: true }).press('Enter');
  const url = page.url();
  const locker = page.getByRole('dialog', { name: 'Locker #123' });
  await locker.getByRole('button', { name: 'Customer Profile', exact: true }).click();
  const profile = page.getByRole('dialog', { name: 'Customer Profile', exact: true });
  await expect(profile.getByText('Opening Due Customer', { exact: true })).toBeVisible();
  await expect(profile).toContainText('recorded verification does not confirm');
  await profile.getByRole('button',{name:'Close customer profile',exact:true}).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(profile.getByRole('button',{name:'Edit customer',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  expect(page.url()).toBe(url);
  await profile.getByRole('button', { name: 'Edit customer', exact: true }).click();
  const edit = page.getByRole('dialog', { name: /Edit Customer/i });
  await expect(edit).toBeVisible();
  const email = `same-page-${testInfo.project.name}@example.test`;
  await edit.locator('#customer-email').fill(email);
  await edit.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(profile.getByText(email, { exact: true })).toBeVisible();
  await profile.getByRole('button', { name: 'Edit customer', exact: true }).click();
  await edit.locator('#customer-email').fill('');
  await edit.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(profile.getByText(email, { exact: true })).toHaveCount(0);
  await expect(profile.getByText('Email', { exact: true }).locator('..')).toContainText('Not recorded');
  expect(page.url()).toBe(url);
  await page.keyboard.press('Escape');
  await expect(profile).not.toBeVisible();
  await expect(locker).toBeVisible();
  await locker.getByRole('button', { name: 'Customer Profile', exact: true }).click();
  await profile.getByRole('button', { name: 'KYC documents', exact: true }).click();
  const kycPopup = page.getByRole('dialog', { name: 'KYC & ID documents', exact: true });
  await expect(kycPopup.getByRole('region', { name: 'Locker KYC documents' })).toBeVisible();
  await kycPopup.getByRole('button', { name: 'Close', exact: true }).click();
  expect(page.url()).toBe(url);
  await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  const closure = page.getByRole('dialog', { name: 'Close Locker 123', exact: true });
  await expect(closure).toBeVisible();
  await expect(closure).toContainText('Opening Due Customer');
  await expect(closure.getByLabel('Deposit refund (INR)', { exact: true })).toHaveJSProperty('readOnly', true);
  expect(page.url()).toBe(url);
  await closure.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(locker).toBeVisible();
  const lockerResponse = await page.request.get('/api/lockers?search=123');
  const lockerRecord = (await lockerResponse.json()).data.lockers.find((item: any) => item.lockerNumber === '123');
  const agreementResponse = await page.request.get(`/api/lockers/${lockerRecord._id}/allocations`);
  const agreement = (await agreementResponse.json()).data.currentAllocation;
  const created = await page.request.post('/api/closures', { headers: { Origin: new URL(url).origin }, data: { allocationId: agreement._id, closureReason: 'Same-page browser closure request' } });
  expect(created.status()).toBe(201);
  const closureRecord = (await created.json()).data;
  await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  const workflow = page.getByRole('dialog', { name: closureRecord.closureNumber, exact: true });
  await expect(workflow).toBeVisible();
  await workflow.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Record Payment/i })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable:true, value:async()=>{throw new DOMException('Permission denied','NotAllowedError');} }); });
  await page.getByRole('button',{name:/Open Camera/}).click();
  const camera=page.getByRole('dialog',{name:'Receipt Camera',exact:true});
  await expect(camera).toContainText('Camera access was denied');
  await page.keyboard.press('Escape');await expect(camera).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:/Record Payment/i})).toBeVisible();
  await expect(page.getByRole('button',{name:/Open Camera/})).toBeFocused();
  await page.evaluate(() => {
    (window as any).stoppedCameraTracks=0;
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>new Promise(resolve=>{(window as any).finishCamera=()=>resolve({getTracks:()=>[{stop:()=>{(window as any).stoppedCameraTracks++;}}]});})});
  });
  await page.getByRole('button',{name:/Open Camera/}).click();await expect(camera).toBeVisible();
  await camera.getByRole('button',{name:'Close camera',exact:true}).click();
  await page.evaluate(()=>(window as any).finishCamera());
  await expect.poll(()=>page.evaluate(()=>(window as any).stoppedCameraTracks)).toBe(1);
  await expect(camera).toHaveCount(0);
  expect(page.url()).toBe(url);
  await page.getByRole('dialog', { name: /Record Payment/i }).getByRole('button', { name: /Close/ }).first().click();
  await locker.getByRole('button', { name: /Deposit & Refunds/ }).click();
  await page.getByRole('dialog',{name:'Deposit & Refunds',exact:true}).getByRole('button', { name: 'Collect deposit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Collect/i })).toBeVisible();
  expect(page.url()).toBe(url);
  const cancelled = await page.request.post(`/api/closures/${closureRecord._id}/cancel`, { headers: { Origin: new URL(url).origin }, data: { reason: 'Disposable browser test cleanup' } });
  expect(cancelled.status()).toBe(200);
});


test('draft refund submission and lost payout response remain safe on the locker page', async ({ page }) => {
  let submitted = false, paid = false, allocationId = '';
  const draftId = '000000000000000000000090', approvedId = '000000000000000000000091';
  const refund = (id: string, amount: number, status: string) => ({ _id: id, allocationId, refundNumber: `AUDIT-${id.slice(-2)}`, requestedAmount: amount, approvedAmount: amount, status, createdAt: '2026-10-30T00:00:00.000Z', customerId: { fullName: 'Refund Customer' }, lockerId: { lockerNumber: '123' } });
  await page.route('**/api/refunds?**', route => { allocationId = new URL(route.request().url()).searchParams.get('allocationId') || ''; return route.fulfill({ json: { success: true, data: { refunds: [refund(draftId, 500, submitted ? 'PENDING_APPROVAL' : 'DRAFT'), refund(approvedId, 1000, paid ? 'PAID' : 'APPROVED')], pagination: { page: 1, total: 2, totalPages: 1 } } } }); });
  await page.route('**/api/deposits/allocation/*/summary', route => route.fulfill({ json: { success: true, data: {
    allocationId: new URL(route.request().url()).pathname.split('/')[4], requiredDeposit: 2000, totalDepositReceived: 2000,
    totalAddAdjustments: 0, totalDeductAdjustments: 0, outstandingDeposit: 0, totalRefunded: paid ? 1000 : 0,
    netDepositHeld: paid ? 1000 : 2000, pendingRefundsCount: (submitted ? 1 : 0) + (paid ? 0 : 1),
    pendingRefundAmount: (submitted ? 500 : 0) + (paid ? 0 : 1000), availableRefundableBalance: submitted ? 500 : 1000,
  } } }));
  await page.route(`**/api/refunds/${draftId}/submit`, async route => { submitted = true; await route.fulfill({ json: { success: true, data: refund(draftId, 500, 'PENDING_APPROVAL') } }); });
  const requests: { key?: string; body: string | null }[] = [];
  await page.route(`**/api/refunds/${approvedId}/pay`, async route => {
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (requests.length === 1) await route.abort('failed');
    else { paid = true; await route.fulfill({ json: { success: true, data: { refund: refund(approvedId, 1000, 'PAID'), payment: { _id: 'test-payout' } } } }); }
  });
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 123', exact: true }).press('Enter');
  const url = page.url();
  const locker = page.getByRole('dialog', { name: 'Locker #123' });
  await locker.getByRole('button', { name: /Deposit & Refunds/ }).click();
  const deposits=page.getByRole('dialog',{name:'Deposit & Refunds',exact:true});
  await deposits.getByRole('button', { name: 'Submit refund', exact: true }).click();
  await expect(deposits.getByRole('button', { name: 'Review refund', exact: true })).toBeVisible();
  await deposits.getByRole('button', { name: 'Pay refund', exact: true }).click();
  const payout = page.getByRole('dialog', { name: 'Refund payout', exact: true });
  await expect(payout.locator('.bg-white').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await payout.getByRole('button', { name: 'CASH', exact: true }).click();
  await payout.getByRole('button', { name: 'Confirm Payout & Update Ledger', exact: true }).click();
  await expect(payout.getByText(/Do not pay again/)).toBeVisible();
  await expect(payout.getByPlaceholder('Bank UTR # / Cheque Number / Transaction ID')).toBeDisabled();
  await payout.getByRole('button', { name: 'Check & Retry Payout', exact: true }).click();
  await expect(payout).not.toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0].key).toBe(`refund-payout:${approvedId}`);
  expect(requests[1]).toEqual(requests[0]);
  await expect(deposits.getByRole('button', { name: 'Pay refund', exact: true })).toHaveCount(0);
  expect(page.url()).toBe(url);
});


test('closure blocks outstanding rent and Back preserves the locker dossier', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 123', exact: true }).press('Enter');
  const locker = page.getByRole('dialog', { name: 'Locker #123' });
  await locker.getByRole('button', { name: 'Close Locker', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'Close Locker 123', exact: true });
  await wizard.getByRole('checkbox').check();
  await expect(wizard).toContainText('Settle outstanding rent before closing.');
  await expect(wizard.getByRole('button', { name: 'Confirm close', exact: true })).toBeDisabled();
  await wizard.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(locker).toBeVisible();
});
