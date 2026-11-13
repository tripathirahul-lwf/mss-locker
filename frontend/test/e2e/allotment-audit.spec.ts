import { test, expect } from './fixtures';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yK4sAAAAASUVORK5CYII=', 'base64');
async function open(page: any, unit: string) { await page.goto('/login'); await page.getByLabel('Username or Email').fill('browser-test'); await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!'); await page.getByRole('button', { name: /Sign In/i }).click(); await page.getByRole('button', { name: `Open locker ${unit}`, exact: true }).click(); return page.getByRole('dialog', { name: /New Allotment/ }); }
test('allotment uploads reject invalid files visibly and are keyboard accessible', async ({ page }, info) => {
 const modal = await open(page, info.project.name === 'mobile' ? '8' : '7');
 await modal.getByLabel('KYC photo', { exact: true }).setInputFiles({ name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) });
 await expect(modal.getByRole('alert')).toContainText('1 byte');
 await modal.getByLabel('Receipt image or PDF (optional)', { exact: true }).setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
 await expect(modal.getByRole('alert').filter({ hasText: 'PDF, JPG' })).toBeVisible();
 const chooserPromise = page.waitForEvent('filechooser'); await modal.getByRole('button', { name: 'Upload ID proof (image or PDF)', exact: true }).press('Enter'); const chooser = await chooserPromise; await chooser.setFiles({ name: 'id.png', mimeType: 'image/png', buffer: png });
 await expect(modal.getByRole('button', { name: 'Preview ID proof (image or PDF)', exact: true })).toBeVisible();
 await modal.getByLabel('Key number').fill('TEMP-KEY'); await modal.getByRole('checkbox').check(); await modal.getByLabel('Key number').fill('CHANGED-KEY'); await expect(modal.getByRole('checkbox')).not.toBeChecked();
 await modal.getByRole('button', { name: 'Close allotment', exact: true }).click(); await expect(modal).toHaveCount(0);
});
test('numberless ID upload saves a generic document with server-provided compressed MIME', async ({ page }, info) => {
 const unit = info.project.name === 'mobile' ? '8' : '7';
 await page.route('**/api/upload/file', async route => { const response = await route.fetch(); const body = await response.json(); body.data.mimeType = 'image/webp'; await route.fulfill({ response, json: body }); });
 const modal = await open(page, unit);
 await modal.getByLabel('New customer name').fill(`Generic Proof ${unit}`); await modal.getByLabel('Phone', { exact: true }).fill(`987658000${unit}`); await modal.getByLabel('Key number').fill(`GENERIC-KEY-${unit}`); await modal.getByLabel('Receipt number', { exact: true }).fill(`GENERIC-${unit}`);
 await modal.getByLabel('ID proof (image or PDF)', { exact: true }).setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: png }); await modal.getByRole('checkbox').check();
 const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/allocations/complete') && response.request().method() === 'POST'); await modal.getByRole('button', { name: 'Collect & Allot Locker', exact: true }).click();
 const response = await responsePromise; expect(response.status()).toBe(201); const input = response.request().postDataJSON(); expect(input.idDocument).toMatchObject({ documentType: 'OTHER', documentNumber: '', mimeType: 'image/webp' });
 const data = (await response.json()).data; const id = data.allocation.customerId._id;
 const docs = await page.request.get(`/api/customers/${id}/kyc`); expect(docs.ok()).toBeTruthy(); const rows = (await docs.json()).data; expect(rows[0]).toMatchObject({ documentType: 'OTHER', documentNumber: '', verificationStatus: 'PENDING', mimeType: 'image/webp' });
 await expect(page.getByRole('heading', { name: 'Allotment Complete', exact: true })).toBeVisible();
});


test('both allotment KYC files preview and photo replacement/deletion persist after reload', async ({ page }, info) => {
 // The isolated server returns synthetic storage URLs; serve the uploaded image bytes at that boundary.
 await page.route('**/api/upload/private/browser-fixture-*.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
 const unit = info.project.name === 'mobile' ? '8' : '7';
 const modal = await open(page, unit);
 await modal.getByLabel('New customer name').fill(`Dual KYC ${unit}`);
 await modal.getByLabel('Phone', { exact: true }).fill(`987658000${unit}`);
 await modal.getByLabel('Key number').fill(`DUAL-KEY-${unit}`);
 await modal.getByLabel('Receipt number', { exact: true }).fill(`DUAL-${unit}`);
 await modal.getByLabel('KYC photo', { exact: true }).setInputFiles({ name: 'customer-photo.png', mimeType: 'image/png', buffer: png });
 await modal.getByLabel('ID proof (image or PDF)', { exact: true }).setInputFiles({ name: 'identity-proof.png', mimeType: 'image/png', buffer: png });
 await modal.getByRole('checkbox').check();
 await modal.getByRole('button', { name: 'Collect & Allot Locker', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'Allotment Complete', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Done & Close', exact: true }).click();
 const showKyc = async () => {
  await page.getByRole('button', { name: `Open locker ${unit}`, exact: true }).getByRole('button', { name: 'View KYC', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'KYC & ID documents', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
 };
 let kyc = await showKyc();
 await expect(kyc.getByText('2 documents on record')).toBeVisible();
 for (const name of ['customer-photo.png', 'identity-proof.png']) {
  await kyc.getByRole('group').filter({ hasText: name }).getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = page.getByRole('dialog', { name: `${name} Preview`, exact: true });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.getByRole('img', { name, exact: true }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
 }
 const chooser = page.waitForEvent('filechooser');
 await kyc.getByRole('group').filter({ hasText: 'customer-photo.png' }).getByRole('button', { name: 'Replace', exact: true }).click();
 await (await chooser).setFiles({ name: 'replaced-photo.png', mimeType: 'image/png', buffer: png });
 await expect(kyc.getByText('replaced-photo.png', { exact: true })).toBeVisible();
 await expect(kyc.getByText('2 documents on record')).toBeVisible();
 await kyc.getByRole('group').filter({ hasText: 'replaced-photo.png' }).getByRole('button', { name: 'Delete', exact: true }).click();
 await page.getByRole('alertdialog').getByRole('button', { name: 'Delete document', exact: true }).click();
 await expect(kyc.getByText('1 document on record')).toBeVisible();
 await page.reload();
 kyc = await showKyc();
 await expect(kyc.getByText('1 document on record')).toBeVisible();
 await expect(kyc.getByText('identity-proof.png', { exact: true })).toBeVisible();
 await expect(kyc.getByText('KYC photo (customer profile)', { exact: true })).toHaveCount(0);
});
