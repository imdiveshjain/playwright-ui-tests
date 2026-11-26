import { test, expect } from '@playwright/test';

test('Login with valid credentials navigates to dashboard', async ({ page }) => {
  await page.goto('https://qapublic.intalk.cc/intalk_new');
  await page.getByRole('textbox', { name: 'User ID' }).fill('dj_super');
  await page.getByRole('textbox', { name: 'Password' }).fill('Agami@12');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL('https://qapublic.intalk.cc/intalk_new/dashboard/home');
});