import {test,expect} from './fixtures';
test('scroll locks release safely in either order and repeated cleanup is harmless',async({page})=>{
 await page.goto('/login');
 const states=await page.evaluate(async()=>{
  const path='/src/utils/bodyScrollLock.ts';const {lockBodyScroll}=await import(path);
  document.body.style.overflow='auto';
  const parent=lockBodyScroll(),child=lockBodyScroll();parent();const nested=document.body.style.overflow;child();const final=document.body.style.overflow;child();
  const next=lockBodyScroll();next();return {nested,final,reopened:document.body.style.overflow};
 });expect(states).toEqual({nested:'hidden',final:'auto',reopened:'auto'});
});
test('navigating away with stacked locker and deposit dialogs restores dashboard scrolling',async({page})=>{
 await page.goto('/login');await page.getByLabel('Username or Email').fill('browser-test');await page.getByLabel('Password',{exact:true}).fill('BrowserTest123!');await page.getByRole('button',{name:/Sign In/}).click();
 await page.getByRole('button',{name:'Open locker 77',exact:true}).press('Enter');
 const locker=page.getByRole('dialog',{name:'Locker #77',exact:true});await locker.getByRole('button',{name:/^Deposit & Refunds/}).click();
 await expect(page.getByRole('dialog',{name:'Deposit & Refunds',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
 await page.getByRole('button',{name:'Staff',exact:true}).evaluate((button:HTMLElement)=>button.click());
 await page.waitForURL('**/users');await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});
