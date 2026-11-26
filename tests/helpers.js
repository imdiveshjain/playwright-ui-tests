import { expect } from '@playwright/test';

export async function login(page) {
  // Credentials come from the .env file (loaded in playwright.config.js), never from the code
  const user = process.env.QA_USER;
  const password = process.env.QA_PASSWORD;
  if (!user || !password) {
    throw new Error('QA_USER and QA_PASSWORD are not set. Create a .env file (see .env.example).');
  }

  await page.goto('https://qapublic.intalk.cc/intalk_new');
  await page.getByRole('textbox', { name: 'User ID' }).fill(user);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  const forceLoginButton = page.getByRole('button', { name: 'Force Login' });
  try {
    await expect(forceLoginButton).toBeVisible({ timeout: 10000 });
    await forceLoginButton.click();
  } catch {
    // Force Login prompt did not appear, continue normally
  }

  await expect(page.locator('#root')).toBeVisible();
}

export async function goToCallAutomation(page) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('textbox', { name: 'Search...' }).fill('Call Automation');
  await page.getByRole('link', { name: 'Call Automation Call' }).click();
}

export async function goToAdvanceCallManagement(page) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('textbox', { name: 'Search...' }).fill('advance');
  await page.getByRole('link', { name: 'Advance Call Management' }).click();
}