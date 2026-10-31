import { test, expect } from './fixtures';
async function openRenewal(page: any) {
  await page.goto('/login'); await page.getByLabel('Username or Email').fill('browser-test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!'); await page.getByRole('button', { name: /Sign In/i }).click();
  await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter');
  const locker = page.getByRole('dialog', { name: 'Locker #77', exact: true });
  await locker.getByRole('button', { name: 'Renew Lease', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Renew locker 77', exact: true });
  await expect(modal).toBeVisible(); return { modal, locker };
}
test('renewal reference layout has editable coverage, proportional rent, exact GST and recoverable submission errors', async ({ page }, testInfo) => {
  let submissions = 0; let payload: any;
  await page.route('**/api/renewals/generate', async route => {
    submissions++; payload = route.request().postDataJSON(); await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 409, json: { message: 'An overlapping invoice already exists. Reload the ledger.' } });
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { modal, locker } = await openRenewal(page); const url = page.url();
  await expect(modal).toContainText('Reference Customer'); await expect(modal).toContainText('K-1007');
  await expect(modal).not.toContainText('704724216043');
  await expect(modal.getByText('Security deposit held', { exact: true }).locator('..')).toContainText('6,000.00');
  await modal.getByLabel('Tenure', { exact: true }).selectOption('HALF_YEARLY');
  await expect(modal.getByLabel('Base rent for this period (INR)', { exact: true })).toHaveValue('1500');
  await modal.getByLabel('Tenure', { exact: true }).selectOption('MONTHLY');
  await expect(modal.getByLabel('Base rent for this period (INR)', { exact: true })).toHaveValue('250');
  const defaultNext = await modal.getByLabel('Next renewal date', { exact: true }).inputValue();
  const custom = new Date(defaultNext + 'T00:00:00Z'); custom.setUTCDate(custom.getUTCDate() + 5);
  await modal.getByLabel('Next renewal date', { exact: true }).fill(custom.toISOString().slice(0, 10));
  await modal.getByRole('button', { name: 'Use tenure date', exact: true }).click();
  await expect(modal.getByLabel('Next renewal date', { exact: true })).toHaveValue(defaultNext);
  await modal.getByLabel('Other charges (INR)', { exact: true }).fill('10.25');
  await modal.getByLabel('Discount (INR)', { exact: true }).fill('0.25');
  await expect(modal).toContainText('306.80');
  await modal.getByLabel('GST rate', { exact: true }).selectOption('0'); await expect(modal).toContainText('260.00');
  await page.screenshot({ path: testInfo.outputPath('renewal-reference.png'), fullPage: false });
  await modal.getByRole('button', { name: 'Issue renewal bill', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Issuing...', exact: true })).toBeDisabled();
  await expect(modal.getByLabel('Renewal start date', { exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
  await expect(modal.getByRole('alert')).toContainText('overlapping invoice');
  expect(submissions).toBe(1); expect(payload).toMatchObject({ baseRent: 250, otherCharges: 10.25, discount: .25, taxAmount: 0, nextRenewalDueDate: defaultNext });
  await expect(modal.getByRole('button', { name: 'Issue renewal bill', exact: true })).toBeEnabled();
  await modal.getByLabel('Next renewal date', { exact: true }).fill(await modal.getByLabel('Renewal start date', { exact: true }).inputValue());
  await expect(modal.getByRole('button', { name: 'Issue renewal bill', exact: true })).toBeDisabled();
  await modal.getByRole('button', { name: 'Use tenure date', exact: true }).click();
  await modal.getByLabel('Discount (INR)', { exact: true }).fill('999999');
  await expect(modal.getByRole('button', { name: 'Issue renewal bill', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(locker).toBeVisible();
  expect(page.url()).toBe(url); expect(errors).toEqual([]);
});
test('renewal history and KYC actions stay on the same page with focus restored', async ({ page }) => {
  const { modal, locker } = await openRenewal(page); const url = page.url();
  await expect(modal.getByRole('region', { name: 'Renewal bill and receipt history' })).toContainText('REFERENCE-77');
  await modal.getByRole('button', { name: 'KYC & ID documents', exact: true }).click();
  await expect(modal).toHaveCount(0); await expect(locker.getByRole('region', { name: 'Locker KYC documents' })).toBeVisible();
  await locker.getByRole('button', { name: 'Details', exact: true }).click();
  await locker.getByRole('button', { name: 'Renew Lease', exact: true }).click();
  await modal.getByRole('button', { name: 'Issue renewal bill', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Close renewal', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
  await expect(locker.getByRole('button', { name: 'Renew Lease', exact: true })).toBeFocused(); expect(page.url()).toBe(url);
});

test('issuing a renewal opens collection on the same page without fabricating a receipt', async ({ page }) => {
  const { modal } = await openRenewal(page); const url = page.url(); let invoiceId = '', authorization = '';
  page.on('request', req => { if (req.url().endsWith('/api/renewals/generate')) authorization = req.headers()['authorization'] || ''; });
  try {
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/renewals/generate') && response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Issue renewal bill', exact: true }).click();
    const response = await responsePromise; expect(response.status()).toBe(201);
    const invoice = (await response.json()).data; invoiceId = invoice._id;
    expect(invoice.balanceAmount).toBe(3540); expect(invoice.paymentStatus).toBe('UNPAID');
    await expect(modal).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Record Payment Collection', exact: true })).toBeVisible();
    expect(page.url()).toBe(url);
  } finally {
    if (invoiceId) {
      const response = await page.request.post(`/api/renewals/${invoiceId}/cancel`, { headers: { Authorization: authorization, Origin: new URL(page.url()).origin }, data: { reason: 'Browser test cleanup: uncollected renewal' } });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
  }
});
