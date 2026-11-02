import {test,expect} from './fixtures';
test('locker dashboard defers dossier tools and refund history until requested',async({page})=>{
 const tools:string[]=[],refunds:string[]=[],stats:string[]=[];
 page.on('request',request=>{const url=request.url();if(url.includes('/LockerDetailModal.tsx'))tools.push(url);if(/\/api\/refunds\?/.test(url))refunds.push(url);if(url.includes('/api/lockers/stats'))stats.push(url);});
 await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/}).click();
 await expect(page.getByRole('button',{name:'Open locker 77',exact:true})).toBeVisible();
 expect(tools).toHaveLength(0);expect(refunds).toHaveLength(0);
 await page.getByRole('button',{name:'Open locker 77',exact:true}).press('Enter');
 const locker=page.getByRole('dialog',{name:'Locker #77',exact:true});await expect(locker.getByRole('region',{name:'Bill and receipt history'})).toBeVisible();
 expect(tools.length).toBeGreaterThan(0);expect(refunds).toHaveLength(0);expect(stats).toHaveLength(1);
 await locker.getByRole('button',{name:/^Deposit & Refunds/}).click();
 await expect(page.getByRole('dialog',{name:'Deposit & Refunds',exact:true})).toBeVisible();
 await expect.poll(()=>refunds.length).toBe(1);
});
