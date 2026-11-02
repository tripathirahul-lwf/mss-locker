import { test, expect } from './fixtures';
async function openLedger(page: any) {
 await page.goto('/login'); await page.getByLabel('Username or Email').fill('browser-test'); await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!'); await page.getByRole('button', { name: /Sign In/i }).click();
 await page.getByRole('button', { name: 'Open locker 77', exact: true }).press('Enter'); const locker = page.getByRole('dialog', { name: 'Locker #77', exact: true });
 await locker.getByRole('button', { name: /^Deposit & Refunds/ }).click(); return { locker, ledger: page.getByRole('dialog', { name: 'Deposit & Refunds',exact:true }).getByRole('region', { name: 'Deposit and refunds' }) };
}
test('deposit summary failure disables stale financial actions and retries without leaving locker', async ({ page }) => {
 let failed = true;
 await page.route('**/api/deposits/allocation/*/summary', async route => { if (failed) return route.fulfill({ status: 503, json: { message: 'Ledger unavailable' } }); await route.continue(); });
 const { locker, ledger } = await openLedger(page); const url = page.url();
 await expect(ledger.getByRole('alert')).toContainText('Could not load deposit balance');
 await expect(ledger.getByRole('button', { name: 'Adjust deposit', exact: true })).toBeDisabled(); await expect(ledger.getByRole('button', { name: 'Request refund', exact: true })).toBeDisabled();
 failed = false; await ledger.getByRole('button', { name: 'Retry deposit balance', exact: true }).click();
 await expect(ledger.getByRole('button', { name: 'Request refund', exact: true })).toBeEnabled();
 await expect(ledger).toContainText('Adjustment credits'); await expect(ledger).toContainText('Deposit still required');
 await ledger.getByRole('button', { name: 'Request refund', exact: true }).click(); const refund = page.getByRole('dialog', { name: 'Create refund request', exact: true });
 await expect(refund.getByLabel('Requested refund amount', { exact: true })).toHaveValue('6000'); await refund.getByLabel('Refund reason', { exact: true }).pressSequentially('Customer requested refund');
 await page.keyboard.press('Escape'); await expect(refund).toHaveCount(0); await expect(ledger.getByRole('button', { name: 'Request refund', exact: true })).toBeFocused();
 expect(page.url()).toBe(url); await expect(locker).toBeVisible();
});
test('adjustment dialog is above locker, contains keyboard focus and preserves fields after a failed save', async ({ page }, testInfo) => {
 let count = 0; await page.route('**/api/deposits/adjust', async route => { count++; await new Promise(resolve => setTimeout(resolve, 400)); await route.fulfill({ status: 409, json: { message: 'Deposit balance changed. Reload and retry.' } }); });
 const { ledger, locker } = await openLedger(page); await ledger.getByRole('button', { name: 'Adjust deposit', exact: true }).click();
 const modal = page.getByRole('dialog', { name: 'Deposit balance adjustment', exact: true }); await expect(modal).toBeVisible();
 await modal.getByLabel('Adjustment amount', { exact: true }).fill('100'); await modal.getByLabel('Adjustment reason', { exact: true }).pressSequentially('Key replacement cost');
 await page.screenshot({ path: testInfo.outputPath('deposit-adjustment.png') });
 await modal.getByRole('button', { name: 'Confirm Adjustment', exact: true }).click();
 await expect(modal.getByLabel('Adjustment amount', { exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
 await expect(modal).toContainText('Deposit balance changed'); await expect(modal.getByLabel('Adjustment reason', { exact: true })).toHaveValue('Key replacement cost'); expect(count).toBe(1);
 await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(locker).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('cheque deposit collects bank and cheque date and sends a complete idempotent request', async ({ page }) => {
 let payload: any; await page.route('**/api/deposits/allocation/*/summary', async route => { const response = await route.fetch(); const body = await response.json(); Object.assign(body.data, { totalDepositReceived: 0, totalAddAdjustments: 0, totalDeductAdjustments: 0, totalRefunded: 0, netDepositHeld: 0, pendingRefundAmount: 0, availableRefundableBalance: 0, outstandingDeposit: 6000 }); await route.fulfill({ response, json: body }); });
 await page.route('**/api/deposits/collect', async route => { payload = route.request().postDataJSON(); expect(route.request().headers()['idempotency-key']).toBeTruthy(); await route.fulfill({ status: 409, json: { message: 'Collection conflict for test' } }); });
 const { ledger } = await openLedger(page); await ledger.getByRole('button', { name: 'Collect deposit', exact: true }).click(); const modal = page.getByRole('dialog', { name: /Collect.*Deposit/i });
 await modal.getByText('Cheque', { exact: true }).click(); await modal.getByLabel(/^Cheque number/).fill('123456');
 await expect(modal.getByRole('button', { name: 'Confirm and issue receipt', exact: true })).toBeDisabled();
 await modal.getByLabel('Bank name', { exact: true }).fill('Test Bank'); await modal.getByLabel('Cheque date', { exact: true }).fill('2026-10-30');
 await modal.getByRole('button', { name: 'Confirm and issue receipt', exact: true }).click(); await expect(modal.getByRole('alert')).toContainText('Collection conflict');
 expect(payload).toMatchObject({ paymentMethod: 'CHEQUE', chequeNumber: '123456', bankName: 'Test Bank', chequeDate: '2026-10-30', amount: 6000 });
});

test('ambiguous deposit responses freeze the request and retry with the same key and values', async ({ page }) => {
 const requests: any[] = []; const keys: string[] = [];
 await page.route('**/api/deposits/allocation/*/summary', async route => { const response = await route.fetch(); const body = await response.json(); Object.assign(body.data, { totalDepositReceived: 0, netDepositHeld: 0, availableRefundableBalance: 0, outstandingDeposit: 6000 }); await route.fulfill({ response, json: body }); });
 await page.route('**/api/deposits/collect', async route => { requests.push(route.request().postDataJSON()); keys.push(route.request().headers()['idempotency-key']); await route.fulfill({ status: requests.length === 1 ? 503 : 409, json: { message: 'Review collection ledger' } }); });
 const { ledger } = await openLedger(page); await ledger.getByRole('button', { name: 'Collect deposit', exact: true }).click(); const modal = page.getByRole('dialog', { name: /Collect.*Deposit/i });
 await modal.getByRole('button', { name: 'Confirm and issue receipt', exact: true }).click(); await expect(modal.getByRole('alert')).toContainText('unconfirmed');
 await expect(modal.getByLabel(/^Deposit amount/)).toBeDisabled(); await modal.getByRole('button', { name: 'Retry same collection', exact: true }).click();
 await expect(modal.getByRole('alert')).toContainText('unconfirmed'); await expect(modal.getByLabel(/^Deposit amount/)).toBeDisabled(); expect(requests[0]).toEqual(requests[1]); expect(keys[0]).toBe(keys[1]);
});

test('deposit popup restores the dossier and rejects contradictory refundable balances',async({page})=>{
 await page.route('**/api/deposits/allocation/*/summary',async route=>{const response=await route.fetch();const body=await response.json();body.data.availableRefundableBalance+=1;await route.fulfill({response,json:body});});
 const {locker,ledger}=await openLedger(page),url=page.url();
 await expect(ledger.getByRole('alert')).toContainText('Deposit ledger needs reconciliation');
 await expect(ledger.getByRole('button',{name:'Request refund',exact:true})).toBeDisabled();
 const popup=page.getByRole('dialog',{name:'Deposit & Refunds',exact:true});
 await popup.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Tab');
 await expect(popup.getByRole('button',{name:'Close deposit popup',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);await expect(locker).toBeVisible();
 await expect(locker.getByRole('button',{name:/^Deposit & Refunds/})).toBeFocused();expect(page.url()).toBe(url);
 expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
});

test('unconfirmed adjustment cannot be submitted again',async({page})=>{
 let count=0;await page.route('**/api/deposits/adjust',async route=>{count++;await route.fulfill({status:503,json:{message:'Unconfirmed'}});});
 const {ledger}=await openLedger(page);await ledger.getByRole('button',{name:'Adjust deposit',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Deposit balance adjustment',exact:true});
 await modal.getByLabel('Adjustment amount',{exact:true}).fill('100');await modal.getByLabel('Adjustment reason',{exact:true}).fill('Correction review');
 await modal.getByRole('button',{name:'Confirm Adjustment',exact:true}).click();
 await expect(modal).toContainText('Adjustment result is unconfirmed');await expect(modal.getByRole('button',{name:'Confirm Adjustment',exact:true})).toBeDisabled();expect(count).toBe(1);
});
