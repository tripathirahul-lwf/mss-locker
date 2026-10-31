import { test as base, expect } from '@playwright/test';
export const test = base.extend<{ isolatedDatabase: void }>({
  isolatedDatabase: [async ({ request }, use) => {
    const response = await request.post('http://127.0.0.1:25099/__test/reset');
    expect(response.ok(), await response.text()).toBeTruthy();
    await use(undefined);
  }, { auto: true }],
});
export { expect };
