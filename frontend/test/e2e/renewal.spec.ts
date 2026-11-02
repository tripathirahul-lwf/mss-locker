import { test, expect } from './fixtures';
async function openRenewal(page:any) {
  await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/i}).click();await page.waitForURL(url=>url.pathname==='/');
  await page.getByRole('button',{name:'Open locker 77',exact:true}).press('Enter');
  const locker=page.getByRole('dialog',{name:'Locker #77',exact:true});await locker.getByRole('button',{name:'Renew Lease',exact:true}).click();
  const modal=page.getByRole('dialog',{name:/^Renew .*Locker 77$/});await expect(modal).toBeVisible();return {modal,locker};
}
test('renew reference modal validates editable amount, tenure, dates and receipt and retains failed input',async({page},testInfo)=>{
  let count=0,payload:any;
  await page.route('**/api/renewals/collect',async route=>{count++;payload=route.request().postDataJSON();await new Promise(resolve=>setTimeout(resolve,300));await route.fulfill({status:409,json:{message:'Receipt number already exists. Use a unique receipt number.'}});});
  const {modal,locker}=await openRenewal(page),url=page.url();
  await expect(modal).toContainText('Reference Customer');await expect(modal.getByLabel('Amount paid',{exact:true})).toHaveValue('3540');
  await expect(modal.getByRole('button',{name:'Renew',exact:true})).toBeDisabled();
  await modal.getByLabel('Next tenure',{exact:true}).selectOption('HALF_YEARLY');await expect(modal.getByLabel('Amount paid',{exact:true})).toHaveValue('1770');
  await modal.getByLabel('Next tenure',{exact:true}).selectOption('MONTHLY');await expect(modal.getByLabel('Amount paid',{exact:true})).toHaveValue('295');
  const next=await modal.getByLabel('Next renewal date',{exact:true}).inputValue();const custom=new Date(next);custom.setUTCDate(custom.getUTCDate()+5);
  await modal.getByLabel('Next renewal date',{exact:true}).fill(custom.toISOString().slice(0,10));
  await modal.getByLabel('Receipt number',{exact:true}).fill('RENEW-REFERENCE');
  await modal.getByLabel('Amount paid',{exact:true}).fill('0');await expect(modal.getByRole('button',{name:'Renew',exact:true})).toBeDisabled();await modal.getByLabel('Amount paid',{exact:true}).fill('295');
  await modal.getByLabel('Receipt date',{exact:true}).fill('2099-01-01');await expect(modal.getByRole('button',{name:'Renew',exact:true})).toBeDisabled();
  await modal.getByLabel('Receipt date',{exact:true}).fill(await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())));
  await page.screenshot({path:testInfo.outputPath('renew-reference.png')});
  await modal.getByRole('button',{name:'Renew',exact:true}).click();await expect(modal.getByRole('button',{name:'Saving...',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(modal).toBeVisible();
  await expect(modal.getByRole('alert')).toContainText('Receipt number already exists');expect(count).toBe(1);expect(payload).toMatchObject({amount:295,billingCycle:'CUSTOM',cashReceived:true,receiptNumber:'RENEW-REFERENCE',nextRenewalDueDate:custom.toISOString().slice(0,10)});
  await expect(modal.getByLabel('Receipt number',{exact:true})).toHaveValue('RENEW-REFERENCE');
  await modal.getByRole('button',{name:'Close',exact:true}).click();await expect(locker).toBeVisible();expect(page.url()).toBe(url);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('renew saves paid invoice and receipt together and lost response retry does not collect twice',async({page})=>{
  const requests:any[]=[];let committed:any;
  await page.route('**/api/renewals/collect',async route=>{
    requests.push(route.request().postDataJSON());if(requests.length===2){await route.fulfill({status:429,json:{message:'Try again later.'}});return;}const response=await route.fetch();expect(response.status()).toBe(201);committed=(await response.json()).data;
    if(requests.length===1)await route.abort('failed');else await route.fulfill({response,json:{success:true,data:committed}});
  });
  const {modal,locker}=await openRenewal(page),url=page.url();await modal.getByLabel('Receipt number',{exact:true}).fill('RENEW-SAVED-77');
  const next=await modal.getByLabel('Next renewal date',{exact:true}).inputValue();
  await modal.getByRole('button',{name:'Renew',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('Do not collect cash again');await expect(modal.getByLabel('Amount paid',{exact:true})).toBeDisabled();
  await modal.getByRole('button',{name:'Check & retry renewal',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('Do not collect cash again');await expect(modal.getByLabel('Amount paid',{exact:true})).toBeDisabled();await modal.getByRole('button',{name:'Check & retry renewal',exact:true}).click();await expect(modal).toHaveCount(0);expect(requests).toHaveLength(3);expect(requests[1]).toEqual(requests[0]);expect(requests[2]).toEqual(requests[0]);
  expect(committed.invoice.status).toBe('PAID');expect(committed.invoice.balanceAmount).toBe(0);expect(committed.payment.amount).toBe(3540);expect(committed.allocation.nextRenewalDueDate.slice(0,10)).toBe(next);
  await expect(locker.getByRole('region',{name:'Bill and receipt history'})).toContainText('RENEW-SAVED-77');expect(page.url()).toBe(url);
});
test('renew attachment previews locally, rejects invalid files and restores keyboard focus on close',async({page})=>{
  const {modal,locker}=await openRenewal(page);const attachment=modal.getByLabel('Receipt attachment',{exact:true});
  await attachment.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await expect(modal.getByRole('alert')).toContainText('up to 5 MB');
  await attachment.setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lWQAAAAASUVORK5CYII=','base64')});
  await modal.getByRole('button',{name:'Preview renewal receipt',exact:true}).click();await expect(modal.getByRole('img',{name:'renewal receipt preview',exact:true})).toBeVisible();
  await modal.getByRole('button',{name:'Remove attachment',exact:true}).click();await expect(modal.getByRole('button',{name:'Preview renewal receipt',exact:true})).toHaveCount(0);
  await modal.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Tab');await expect(modal.getByRole('button',{name:'Close renewal',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(locker.getByRole('button',{name:'Renew Lease',exact:true})).toBeFocused();
});

test('renew keeps negotiated rates across tenure changes and explains custom coverage',async({page})=>{
  const {modal}=await openRenewal(page);
  await expect(modal).toContainText('Enter a receipt number to enable Renew.');
  await modal.getByLabel('Amount paid',{exact:true}).fill('1200');
  await modal.getByLabel('Next tenure',{exact:true}).selectOption('TRIENNIAL');
  await expect(modal.getByLabel('Amount paid',{exact:true})).toHaveValue('3600');
  await modal.getByLabel('Next tenure',{exact:true}).selectOption('HALF_YEARLY');
  await expect(modal.getByLabel('Amount paid',{exact:true})).toHaveValue('600');
  const expected=await modal.getByLabel('Next renewal date',{exact:true}).inputValue();
  const custom=new Date(expected);custom.setUTCDate(custom.getUTCDate()+4);
  await modal.getByLabel('Next renewal date',{exact:true}).fill(custom.toISOString().slice(0,10));
  await expect(modal).toContainText('Custom renewal date selected.');
  await modal.getByRole('button',{name:'Use tenure date',exact:true}).click();
  await expect(modal.getByLabel('Next renewal date',{exact:true})).toHaveValue(expected);
  await expect(modal.getByLabel('Amount paid',{exact:true})).toHaveValue('600');
  await expect(modal).toContainText('Advance renewal:');
  expect(await page.locator('body > [inert]').count()).toBeGreaterThan(0);
});
