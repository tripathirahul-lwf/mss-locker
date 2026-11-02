import {test,expect} from './fixtures';
async function openLocker(page:any) {
 await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/i}).click();await page.waitForURL(url=>url.pathname==='/');
 await page.getByRole('button',{name:'Open locker 77',exact:true}).press('Enter');return page.getByRole('dialog',{name:'Locker #77',exact:true});
}
test('edit popup saves or discards while preserving the underlying locker dossier',async({page},info)=>{
 const locker=await openLocker(page),url=page.url();await locker.getByRole('button',{name:'Edit',exact:true}).click();
 const form=page.getByRole('dialog',{name:/Edit Locker #/});await expect(form.locator('#rack-number')).toBeVisible();
 await expect(page.getByRole('dialog')).toHaveCount(2);await expect(locker.getByTestId('occupied-locker-summary').getByRole('definition').filter({hasText:'Reference Customer'}).first()).toBeVisible();
 await form.locator('#rack-number').fill('Rack Unified');await form.getByRole('button',{name:'Cancel',exact:true}).click();
 const confirm=page.getByRole('alertdialog',{name:'Discard unsaved changes?',exact:true});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(form.locator('#rack-number')).toHaveValue('Rack Unified');await page.screenshot({path:info.outputPath('inline-edit.png')});
 await form.getByRole('button',{name:'Save Locker Changes',exact:true}).click();await expect(form).toHaveCount(0);await expect(locker).toBeVisible();await expect(locker.getByText('Size A',{exact:false}).first()).toContainText('Rack Unified');expect(page.url()).toBe(url);
 await locker.getByRole('button',{name:'Edit',exact:true}).click();await expect(form.locator('#rack-number')).toHaveValue('Rack Unified');await form.locator('#rack-number').fill('Unsaved rack');
 await page.keyboard.press('Escape');await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(form).toHaveCount(0);await expect(locker).toBeVisible();
});
test('KYC popup uploads and deletes documents while retaining the underlying locker modal',async({page},info)=>{
 await page.route('**/api/upload/file',async route=>{await new Promise(resolve=>setTimeout(resolve,500));const response=await route.fetch();await route.fulfill({response});});
 const locker=await openLocker(page),url=page.url();await locker.getByRole('button',{name:/KYC Compliance/}).click();
 const popup=page.getByRole('dialog',{name:'KYC & ID documents',exact:true});
 const panel=popup.getByRole('region',{name:'Locker KYC documents',exact:true});await expect(panel).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(2);
 await expect(locker.getByRole('region',{name:'Bill and receipt history'})).toBeAttached();await expect(locker.getByTestId('occupied-locker-summary').getByRole('definition').filter({hasText:'Reference Customer'}).first()).toBeAttached();
 await panel.getByLabel('KYC document file',{exact:true}).setInputFiles({name:'unified-proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lWQAAAAASUVORK5CYII=','base64')});
 await expect(popup.getByRole('button',{name:'Close',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(popup).toBeVisible();await expect(panel).toContainText('uploaded successfully');
 const document=panel.getByRole('group').filter({hasText:'unified-proof.png'});await expect(document).toBeVisible();await page.screenshot({path:info.outputPath('kyc-popup.png')});
 await document.getByRole('button',{name:'Delete',exact:true}).click();const confirm=page.getByRole('alertdialog',{name:'Delete KYC document?',exact:true});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Delete document',exact:true}).click();await expect(document).toHaveCount(0);
 await popup.getByRole('button',{name:'Close',exact:true}).click();await expect(panel).toHaveCount(0);await expect(locker).toBeVisible();await expect(locker.getByRole('button',{name:/KYC Compliance/})).toBeFocused();expect(page.url()).toBe(url);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('vacant locker edit opens a popup above its detail modal',async({page})=>{
 await page.route('**/api/auth/login',async route=>{const response=await route.fetch();const body=await response.json();body.data.user.isSuperAdmin=false;body.data.user.role.code='CATALOG_EDITOR';body.data.user.permissions=body.data.user.permissions.filter((value:string)=>value!=='allocations.create');await route.fulfill({response,json:body});});
 await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/i}).click();
 await page.getByRole('button',{name:'Open locker 3',exact:true}).press('Enter');const locker=page.getByRole('dialog',{name:'Locker #3',exact:true});await locker.getByRole('button',{name:'Edit',exact:true}).click();
 const form=page.getByRole('dialog',{name:/Edit Locker #/});await expect(form.locator('#rack-number')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(2);
 await form.locator('#rack-number').fill('Unsaved vacant rack');await page.keyboard.press('Escape');const confirm=page.getByRole('alertdialog',{name:'Discard unsaved changes?',exact:true});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(form).toHaveCount(0);await expect(locker).toBeVisible();
});

test('KYC popup contains focus and Escape returns to locker before closing the dossier',async({page})=>{
 const locker=await openLocker(page);await locker.getByRole('button',{name:/KYC Compliance/}).click();const popup=page.getByRole('dialog',{name:'KYC & ID documents',exact:true});await expect(popup).toBeVisible();
 await popup.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Tab');await expect(popup.getByRole('button',{name:'Close KYC popup',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);await expect(locker).toBeVisible();expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
 await page.keyboard.press('Escape');await expect(locker).toHaveCount(0);expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});

test('locker card KYC opens only the dedicated popup without billing requests',async({page})=>{
 const unrelated:string[]=[];page.on('request',request=>{if(/\/api\/(renewals\/locker|payments\/locker|deposits\/allocation|refunds\?)/.test(request.url()))unrelated.push(request.url());});
 await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/}).click();
 const card=page.getByRole('button',{name:'Open locker 77',exact:true});const entry=card.getByRole('button',{name:/KYC/});await entry.click();
 const popup=page.getByRole('dialog',{name:'KYC & ID documents',exact:true});await expect(popup).toBeVisible();await expect(popup).toContainText('Reference Customer');
 await expect(page.getByRole('dialog')).toHaveCount(1);expect(unrelated).toHaveLength(0);
 await popup.getByLabel('KYC document file',{exact:true}).setInputFiles({name:'direct-kyc.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lWQAAAAASUVORK5CYII=','base64')});
 await expect(popup).toContainText('uploaded successfully');
 await popup.getByRole('button',{name:'Close',exact:true}).click();await expect(popup).toHaveCount(0);await expect(entry).toBeFocused();expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});

test('late dossier response does not replace the selected KYC popup',async({page})=>{
 let release!:()=>void,finished=false;const wait=new Promise<void>(resolve=>{release=resolve;});
 await page.route(/\/api\/lockers\/[a-f0-9]{24}$/,async route=>{const response=await route.fetch();await wait;await route.fulfill({response});finished=true;});
 await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/}).click();
 const card=page.getByRole('button',{name:'Open locker 77',exact:true});await card.press('Enter');await card.getByRole('button',{name:/KYC/}).press('Enter');
 const popup=page.getByRole('dialog',{name:'KYC & ID documents',exact:true});await expect(popup).toBeVisible();release();await expect.poll(()=>finished).toBe(true);
 await expect(page.getByRole('dialog')).toHaveCount(1);await expect(page.getByRole('dialog',{name:'Locker #77',exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);
});
