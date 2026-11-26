import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.setTimeout(600000);

test.describe.configure({ mode: 'serial' });

async function goToDispositions(page) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('textbox', { name: 'Search...' }).fill('dispositions');
  await page.getByRole('link', { name: 'Dispositions Dispositions' }).click();
}

test('Login with valid credentials', async ({ page }) => {
  await login(page);
});

test('Create a Lead disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestLead_Disposition');
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'Lead' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  
  await page.waitForTimeout(5000);
  await expect(page.getByText('Disposition Data Inserted')).toBeVisible();
  await expect(page.getByText('TestLead_Disposition')).toBeVisible();
});

test('Create a Callback disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestCallback_Disposition');
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'Callback' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  
  await page.waitForTimeout(5000);
  await expect(page.getByText('Disposition Data Inserted')).toBeVisible();
  await expect(page.getByText('TestCallback_Disposition')).toBeVisible();
});

test('Create a Block disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestBlock_Disposition');
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'Block' }).click();
  await page.getByRole('spinbutton', { name: 'Number of Calls' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Call Period' }).fill('1');
  await page.getByRole('button', { name: 'Save' }).click();
  
  await page.waitForTimeout(5000);
  await expect(page.getByText('Disposition Data Inserted')).toBeVisible();
  await expect(page.getByText('TestBlock_Disposition')).toBeVisible();
});

test('Create a DNC Campaign disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestDNCCampaign_Disposition');
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'DNC Campaign' }).click();
  await page.getByRole('spinbutton', { name: 'DNC Expire (Hours)' }).fill('1');
  await page.getByRole('button', { name: 'Save' }).click();
  
  await page.waitForTimeout(5000);
  await expect(page.getByText('Disposition Data Inserted')).toBeVisible();
  await expect(page.getByText('TestDNCCampaign_Disposition')).toBeVisible();
});

test('Create a DNC System disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestDNCSystem_Disposition');
  await page.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'DNC System' }).click();
  await page.getByRole('spinbutton', { name: 'DNC Expire (Hours)' }).fill('1');
  await page.getByRole('button', { name: 'Save' }).click();
  
  await page.waitForTimeout(5000);
  await expect(page.getByText('Disposition Data Inserted')).toBeVisible();
  await expect(page.getByText('TestDNCSystem_Disposition')).toBeVisible();
});

test('Filter dispositions by name shows matching result', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'filter disposition' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestLead_Disposition');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Assertion: exactly 1 matching row shown
  await expect(page.getByRole('row', { name: /TestLead_Disposition/ })).toHaveCount(1);
});

test('Edit an existing disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  // Filter first, to reliably bring the target row into view
  await page.getByRole('button', { name: 'filter disposition' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestDNCCampaign_Disposition');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Click Edit on that specific row
  await page.getByRole('row', { name: 'TestDNCCampaign_Disposition' }).getByLabel('Edit').click();

  // Update a field
  await page.getByRole('spinbutton', { name: 'DNC Expire (Hours)' }).fill('2');
  await page.getByRole('button', { name: 'Save' }).click();

  // Assertion: success toast confirms update
  await expect(page.getByText("Disposition Data Updated")).toBeVisible();
});

test('Save button remains disabled when disposition name is empty', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();

  // Leave Disposition Name empty, just select a type
  // await page.getByRole('combobox').nth(3).click();
  // await page.getByRole('option', { name: 'Lead' }).click();

  // Assertion: Save button is disabled
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('Delete an existing disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page); 

  // Filter first, to reliably bring the target row into view
  await page.getByRole('button', { name: 'filter disposition' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestLead_Disposition');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Click the Delete icon on that specific row
  await page.getByRole('row', { name: 'TestLead_Disposition Edit' }).getByLabel('Delete').click();

  // Confirm deletion in the popup
  await page.getByRole('button', { name: 'Delete' }).click();

  // Assertion: the row no longer appears in the list
  await expect(page.getByRole('row', { name: /TestLead_Disposition/ })).toHaveCount(0);
});

test('Cancellation of creating a new disposition', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestCancel_Disposition');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByText('TestCancel_Disposition')).toHaveCount(0);
});

test('Cancel delete confirmation', async ({ page }) => {
  await login(page);
  await goToDispositions(page);
  
  // Filter first, to reliably bring the target row into view
  await page.getByRole('button', { name: 'filter disposition' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('TestCallback_Disposition');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Click the Delete icon on that specific row
  await page.getByRole('row', { name: 'TestCallback_Disposition Edit' }).getByLabel('Delete').click();

  // Click Cancel in the confirmation popup
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Assertion: the row still appears in the list
  await expect(page.getByRole('row', { name: /TestCallback_Disposition/ })).toHaveCount(1);
});

test('Filtering by a non-existent name shows no results', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'filter disposition' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('NonExistent_Disposition_XYZ');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Assertion 1: no matching rows appear
  await expect(page.getByRole('row', { name: /NonExistent_Disposition_XYZ/ })).toHaveCount(0);

  // Assertion 2: a "no results" message is shown
  await expect(page.getByText(/No Results Found|no data|not found/i)).toBeVisible();
});

test('Duplicate disposition name shows validation error and disables Save', async ({ page }) => {
  await login(page);
  await goToDispositions(page);

  await page.getByRole('button', { name: 'add campaign' }).click();
  await page.getByRole('textbox', { name: 'Disposition Name' }).fill('Interested');

  // Assertion 1: inline validation message appears
  await expect(page.getByText('Disposition is already used')).toBeVisible();

  // Assertion 2: Save button is disabled
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});