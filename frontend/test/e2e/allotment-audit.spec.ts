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
