import { test, expect } from '@playwright/test';

test('Login with valid credentials navigates to dashboard', async ({ page }) => {
  await page.goto('https://qapublic.intalk.cc/intalk_new');

  await page.getByRole('textbox', { name: 'User ID' }).fill('dj_super');
  await page.getByRole('textbox', { name: 'Password' }).fill('Agami@12');

  await page.getByRole('button', { name: 'Login' }).click();

  const forceLoginButton = page.getByRole('button', { name: 'Force Login' });

  // If Force Login appears or directly navigated to dashboard
  try {
    await forceLoginButton.waitFor({ state: 'visible', timeout: 5000 });
    await forceLoginButton.click();
  } catch (e) {
    // Proceed if Force Login button does not appear
  }

  await expect(page).toHaveURL(
    'https://qapublic.intalk.cc/intalk_new/dashboard/home',
    { timeout: 15000 }
  );
});