import { test, expect } from '@playwright/test';
import { login, goToCallAutomation } from './helpers.js';

// label = exact text in the "Call Event" dropdown, short = used in the automation name
// noCampaign = true for events whose form has no "Select Campaign" field
const events = [
  { label: 'Hangup',                                 short: 'Hangup' },
  { label: 'Answered',                               short: 'Answer' },
  { label: 'Abandoned',                              short: 'Abandoned' },
  { label: 'Abandoned On IVR',                       short: 'Aban_IVR', noCampaign: true },
  { label: 'Fail',                                   short: 'Fail' },
  { label: 'Ringing',                                short: 'Ringing' },
  { label: 'Dispose',                                short: 'Dispose' },
  { label: 'Direct Transfer',                        short: 'Direct_Transfer' },
  { label: 'Consultation Hold Call Offered',         short: 'CHC_Offered' },
  { label: 'Consultation Hold Call Answered',        short: 'CHC_Answered' },
  { label: 'Consultation Hold Call Hangup',          short: 'CHC_Hangup' },
  { label: 'Announce Transfer Call Answered',        short: 'ATC_Answered' },
  { label: 'Conference Call Answered',               short: 'Conf_Answered' },
  { label: 'Team Status Call Transfer',              short: 'TSC_Transfer' },
  { label: 'Team Status Call Conference',            short: 'TSC_Conf' },
  { label: 'Team Status Call Whisper',               short: 'TSC_Whisper' },
  { label: 'Team Status Call Barge',                 short: 'TSC_Barge' },
  { label: 'User Call Hangup',                       short: 'UC_Hangup' },
  { label: 'Campaign Pause',                         short: 'Camp_Pause' },
  { label: 'Campaign Resume',                        short: 'Camp_Resume' },
  { label: 'Campaign Stop',                          short: 'Camp_Stop' },
  { label: 'Campaign Start',                         short: 'Camp_Start' },
  { label: 'Lead Cycle End',                         short: 'Lead_Cycle' },
];

// Events that support neither SMS nor Email
const NO_SMS_OR_EMAIL = [
  'Direct Transfer',
  'Consultation Hold Call Offered',
  'Consultation Hold Call Answered',
  'Consultation Hold Call Hangup',
  'Announce Transfer Call Answered',
  'Conference Call Answered',
  'Team Status Call Transfer',
  'Team Status Call Conference',
  'Team Status Call Whisper',
  'Team Status Call Barge',
];

// type        = option picked in "Event Type"
// tag         = used in the automation name
// fields      = every dropdown to fill after the type is selected, in order, as [field label, option] pairs
// unsupported = event labels this type does not support, skipped for this type only
const actions = [
  {
    type: 'Call API',
    tag: 'API',
    fields: [['API', 'DJ_DelayAPI']],
    unsupported: [],
  },
  {
    type: 'SMS',
    tag: 'SMS',
    fields: [['SMS Template', 'DJ_SMS'], ['API', 'DJ_DelayAPI']],
    unsupported: NO_SMS_OR_EMAIL,
  },
  {
    type: 'Email',
    tag: 'Email',
    fields: [['Email Template', 'DJ_Email'], ['Email Configuration', 'test.agamitech@gmail.com']],
    unsupported: NO_SMS_OR_EMAIL,
  },
];

// Guard: an unsupported label that matches no event is a typo and would silently keep the event in the run
for (const action of actions) {
  for (const label of action.unsupported) {
    if (!events.some((e) => e.label === label)) {
      throw new Error(`"${label}" in the ${action.type} unsupported list does not match any event label`);
    }
  }
}

const CAMPAIGN = 'DJ_Auto';
const MAX_NAME_LENGTH = 32; // confirmed limit in the UI
const LIST_URL = 'https://qapublic.intalk.cc/intalk_new/settings/call-automation';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Helpers ----------

// MUI selects don't expose an accessible name, so find them by their label text
function selectByLabel(page, label) {
  return page
    .locator('.MuiFormControl-root')
    .filter({ has: page.locator('label', { hasText: new RegExp(`^${escapeRegExp(label)}\\s*\\*?$`, 'i') }) })
    .getByRole('combobox');
}

// Short click timeout so a wrong option label fails in 10s instead of burning the whole test timeout
async function pickOption(page, label, option) {
  await selectByLabel(page, label).click();
  await page
    .getByRole('option', { name: new RegExp(`^${escapeRegExp(option)}$`, 'i') })
    .click({ timeout: 10000 });
}

// Wait for the list page to finish loading after Save redirects back to it
async function waitForList(page) {
  await expect(page).toHaveURL(/\/settings\/call-automation\/?$/);
  await expect(page.getByText(/Showing results/)).toBeVisible({ timeout: 15000 });
}

const rowFor = (page, text) => page.getByRole('row', { name: new RegExp(escapeRegExp(text)) });

// Filter by Event Name and assert how many rows match.
// The whole filter flow is retried together, because a late list reload can wipe out the filtered result.
// No waitForList here on purpose: an empty filtered list may not show "Showing results".
async function expectRows(page, text, count) {
  await expect(async () => {
    const eventName = page.getByRole('textbox', { name: 'Event Name' });
    if (!(await eventName.isVisible())) {
      await page.getByRole('button', { name: 'filter call automation' }).click();
    }
    await eventName.fill(text);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(rowFor(page, text)).toHaveCount(count, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// Wait for the list to load, then filter by name and confirm exactly one match
async function expectRowListed(page, name) {
  await waitForList(page);
  await expectRows(page, name, 1);
}

// e.g. 1103_1623 (month+day_hour+minute)
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// Format: <Short>_<Tag>_<MMDD>_<HHMM>, e.g. Camp_Resume_Email_1103_1623 (27 chars, the longest case)
function makeName(short, tag) {
  const safeShort = short.replace(/[^A-Za-z0-9_]/g, '_');
  const name = `${safeShort}_${tag}_${timestamp()}`;
  if (name.length > MAX_NAME_LENGTH) {
    console.warn(`Name "${name}" is ${name.length} chars, trimming to ${MAX_NAME_LENGTH}`);
  }
  return name.slice(0, MAX_NAME_LENGTH);
}

// ---------- Create ----------

test.describe('Call Automation - Create', () => {
  test.setTimeout(90000); // login + form fill + filter retries

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToCallAutomation(page);
  });

  for (const action of actions) {
    // Only the events this type supports
    const supportedEvents = events.filter((e) => !action.unsupported.includes(e.label));

    for (const { label, short, noCampaign } of supportedEvents) {
      test(`Create ${label} automation with ${action.type}`, async ({ page }) => {
        const name = makeName(short, action.tag);

        await page.getByRole('button', { name: /add advance call-queue mapping/i }).click();
        await page.getByRole('textbox', { name: /^name/i }).fill(name);

        await pickOption(page, 'Call Event', label);

        // Some events (e.g. Abandoned On IVR) have no campaign field, so skip the step for them
        if (!noCampaign) {
          const campaignInput = page.getByRole('combobox', { name: /select campaign/i });
          await expect(campaignInput).toBeVisible({ timeout: 10000 });
          await campaignInput.click();
          await campaignInput.fill(CAMPAIGN);
          await page.getByRole('option', { name: new RegExp(`^${CAMPAIGN}$`, 'i') }).click();
          await page.keyboard.press('Escape');
        }

        await pickOption(page, 'Event Type', action.type);

        // The fields that appear for this type (templates, configuration, API, ...)
        for (const [fieldLabel, fieldOption] of action.fields) {
          await pickOption(page, fieldLabel, fieldOption);
        }

        const save = page.getByRole('button', { name: /^save$/i });
        await expect(save).toBeEnabled({ timeout: 5000 });
        await save.click();

        await expect(page.getByText('Successfully Added Event')).toBeVisible({ timeout: 10000 });

        await expectRowListed(page, name);
      });
    }
  }
});

// ---------- Edit and Delete ----------

const EDIT_FIELD = 'Call Direction'; // confirm against the real form
const EDIT_OPTION = 'All';

// Create a simple Hangup + Call API automation to act on
async function createAutomation(page, name) {
  await page.getByRole('button', { name: /add advance call-queue mapping/i }).click();
  await page.getByRole('textbox', { name: /^name/i }).fill(name);
  await pickOption(page, 'Call Event', 'Hangup');

  const campaignInput = page.getByRole('combobox', { name: /select campaign/i });
  await expect(campaignInput).toBeVisible({ timeout: 10000 });
  await campaignInput.click();
  await campaignInput.fill(CAMPAIGN);
  await page.getByRole('option', { name: new RegExp(`^${CAMPAIGN}$`, 'i') }).click();
  await page.keyboard.press('Escape');

  await pickOption(page, 'Event Type', 'Call API');
  await pickOption(page, 'API', 'DJ_DelayAPI');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.getByText('Successfully Added Event')).toBeVisible({ timeout: 10000 });
  await waitForList(page);
}

// Delete one automation using its own row's Delete button
async function deleteRow(page, name) {
  await expectRowListed(page, name);
  await rowFor(page, name).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm popup
  await expect(page.getByText(/event deleted successfully/i)).toBeVisible({ timeout: 10000 });
}

test.describe('Call Automation - Edit and Delete', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToCallAutomation(page);
  });

  test('Edit a call automation', async ({ page }) => {
    const name = `Edit_${Date.now().toString().slice(-8)}`;
    await createAutomation(page, name);

    try {
      await expectRowListed(page, name);
      await rowFor(page, name).getByRole('button', { name: 'Edit' }).click();
      await pickOption(page, EDIT_FIELD, EDIT_OPTION);
      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/successfully update event/i)).toBeVisible({ timeout: 10000 });
    } finally {
      // Always remove the test record, even if the edit failed halfway
      await page.goto(LIST_URL);
      await deleteRow(page, name).catch(() => {});
    }
  });

  test('Delete a single call automation', async ({ page }) => {
    const name = `Del_${Date.now().toString().slice(-8)}`;
    await createAutomation(page, name);

    await deleteRow(page, name);
    await expectRows(page, name, 0);
  });

  test('Bulk delete call automations', async ({ page }) => {
    test.setTimeout(180000); // creates two automations first

    const prefix = `Bulk_${Date.now().toString().slice(-8)}`;
    const names = [`${prefix}_1`, `${prefix}_2`];
    for (const name of names) {
      await createAutomation(page, name);
    }

    // Filter by the shared prefix so only the two rows created here are visible
    await expectRows(page, prefix, 2);

    // Tick each row's first-cell checkbox (the second checkbox in a row is the Status toggle)
    for (const name of names) {
      await rowFor(page, name).getByRole('cell').first().getByRole('checkbox').check();
    }

    // The first "Delete" button on the page is the bulk one, next to Add and Filter
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm popup

    await expect(page.getByText(/events deleted successfully/i)).toBeVisible({ timeout: 10000 });
    await expectRows(page, prefix, 0);
  });
});


