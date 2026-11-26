import { test, expect } from '@playwright/test';
import { login, goToAdvanceCallManagement } from './helpers.js';

// One entry per Type. The fields below the Type dropdown change with the Type,
// so each entry lists its own dropdowns in the order they appear.
//   type         = option in the Type dropdown (same label is used in the filter)
//   listType     = how the Type shows in the list's Type column
//   selects      = [dropdown position, option] pairs, filled in order
//   numbers      = [spinbutton label, value] pairs
//   toast        = success message after Save (Add and Edit show the same message)
//   singleRecord = true if the Type allows only one record in total (any campaign)
//   skipQueue    = true if the Queue filter is unreliable for this Type (filter by Type only)
const types = [
  {
    name: 'All Abandoned Calls (With Queue)',
    type: /^All Abandoned Calls \(with queue\)$/i,
    listType: 'Abandoned',
    selects: [
      [1, 'DJ_Auto'],
      [2, 'DJ_Auto'],
      [3, 'Queue Wise'],
    ],
    numbers: [['Enter Time Duration', '2']],
    toast: 'Abandoned Call Mapping Data Successfully Saved',
  },
  {
    name: 'Abandoned On IVR (Without Queue)',
    type: /^Abandoned On IVR \(without queue\)$/i,
    listType: 'AbandonedOnIVR',
    selects: [
      [1, 'DJ_Auto'],      // only one campaign dropdown for this Type
      [2, 'Queue Wise'],
    ],
    numbers: [['Enter Time Duration', '2']],
    toast: 'Abandoned on IVR Call-Queue Mapping Data Successfully Saved',
    singleRecord: true,
  },
  {
    name: 'IVR Call Back Calls',
    type: /^IVR Call Back Calls$/i,
    listType: 'Callback',
    selects: [
      [1, 'DJ_Auto'],
      [2, 'DJ_Auto'],
    ],
    numbers: [],         // no time-duration field for this Type
    toast: 'IVR Call Back Mapping Data Successfully Saved',
  },
  {
    name: 'Feedback Calls',
    type: /^Feedback Calls$/i,
    listType: 'Feedback',
    selects: [
      [1, 'DJ_Auto'],
      [2, 'zt_ab_ivr'],   // different list from the campaign dropdown
    ],
    numbers: [],
    toast: 'Feedback Call Mapping Data Successfully Saved',
  },
  {
    name: 'Disposition wise Lead Migration',
    type: /^Disposition wise Lead Migration$/i,
    listType: 'Migration',
    selects: [
      [1, { contains: 'DJ_Auto', nth: 1 }],   // Campaign
      [2, 'DJ_Auto'],                         // Queue
      [3, 'DJ_Auto'],                         // List Name
      [4, { contains: 'Call Back' }],         // Disposition
      [5, { contains: 'DJ_Auto', nth: 1 }],   // Migrate Lead to: Campaign
      [6, { contains: 'DJ_Auto', nth: 1 }],   // Migrate Lead to: Queue
      [7, { contains: 'DJ_AutoQueue2' }],     // Migrate Lead to: List Name
    ],
    numbers: [],
    toast: 'Migrate Call Mapping Data Successfully Saved',
  },
  {
    name: 'Failed Survey Reattempts',
    type: /^Failed Survey Reattempts$/i,
    listType: 'FailedFeedbackReattempt',
    selects: [
      [1, 'DJ_Auto'],
    ],
    numbers: [],
    toast: 'Failed Feedback Reattempt Mapping Data Successfully Saved',
    skipQueue: true,   // Queue filter is unreliable for this Type (known bug), filter by Type only
  },
];

const QUEUE = 'DJ_Auto'; // campaign used everywhere
const DELETE_TOAST = 'Advance Call-Queue Mapping Data Successfully Deleted';
const EDIT_DURATION = '3'; // temporary value for the time-duration edit test (original is restored)

// ---------- Helpers ----------

// Open a dropdown by position and pick an option. Short option timeout so a wrong label fails fast.
//   'Text'                       -> option whose whole name is Text
//   /regex/                      -> option matching the regex
//   { contains: 'Text', nth: n } -> n-th option (0-based) whose name contains Text
async function pick(page, position, option) {
  await page.getByRole('combobox').nth(position).click();
  let target;
  if (option instanceof RegExp) {
    target = page.getByRole('option', { name: option });
  } else if (typeof option === 'string') {
    const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    target = page.getByRole('option', { name: new RegExp(`^${escaped}$`, 'i') });
  } else {
    target = page.getByRole('option', { name: option.contains }).nth(option.nth ?? 0);
  }
  await target.click({ timeout: 10000 });
}

// Action cell of every row on the list
const actionCells = (page) => page.getByRole('cell', { name: 'Edit Delete' });

// True when the Queue should be part of the filter / row match
const usesQueue = (t) => !(t.singleRecord || t.skipQueue);

// Rows that are really ours: has the action cell, exactly this Type in its Type cell,
// and (unless the Queue is skipped for this Type) the queue
const matchingRows = (page, t) => {
  let rows = page
    .getByRole('row')
    .filter({ has: actionCells(page) })
    .filter({ has: page.getByRole('cell', { name: t.listType, exact: true }) });
  if (usesQueue(t)) rows = rows.filter({ hasText: QUEUE });
  return rows;
};

// Open the filter panel if it is closed, and pick the Queue
async function filterByQueue(page) {
  const queue = page.getByRole('combobox', { name: 'Queue', exact: true });
  if (!(await queue.isVisible())) {
    await page.getByRole('button', { name: 'filter users' }).click();
  }
  await queue.click();
  await queue.fill(QUEUE.slice(0, 4).toLowerCase());
  await page.getByRole('option', { name: QUEUE, exact: true }).click({ timeout: 5000 });
}

// The filter panel has a Status dropdown that starts on "Enable", so disabled records are hidden.
// Its current text is Enable, Disable or All, which is how it is found (it has no label we can use).
async function setStatusFilter(page, status) {
  await page.getByRole('combobox').filter({ hasText: /^(Enable|Disable|All)$/ }).click();
  await page.getByRole('option', { name: new RegExp(`^${status}$`) }).click({ timeout: 5000 });
}

// Clear the field and type a number. fill() alone leaves the old value in this field.
async function setNumber(locator, value) {
  await locator.click();
  await locator.press('ControlOrMeta+A');
  await locator.press('Backspace');
  await locator.fill(value);
}

// Filter the list by Type, and by Queue too when the Type uses it, and by Status.
// Status defaults to All so that enabled and disabled records are both visible.
// The whole flow is retried because a late list reload can reset the filter.
async function filterBy(page, t, status = 'All') {
  await expect(async () => {
    if (usesQueue(t)) {
      await filterByQueue(page);
    } else if (!(await page.getByRole('combobox', { name: 'Queue', exact: true }).isVisible())) {
      await page.getByRole('button', { name: 'filter users' }).click();
    }
    await pick(page, 3, t.type); // Type dropdown in the filter panel
    await setStatusFilter(page, status);
    await page.getByRole('button', { name: 'Apply' }).click();
  }).toPass({ timeout: 25000 });
  await page.waitForLoadState('networkidle');
}

// Filter, then assert how many of our rows match
async function expectRows(page, t, count, status = 'All') {
  await expect(async () => {
    await filterBy(page, t, status);
    await expect(matchingRows(page, t)).toHaveCount(count, { timeout: 5000 });
  }).toPass({ timeout: 30000 });
}

// Delete every existing record of this Type (+ campaign, unless the Queue is skipped for the Type)
async function deleteMatching(page, t) {
  for (let i = 0; i < 5; i++) { // safety cap
    await filterBy(page, t);

    // Wait for the filtered list to show our row; if none shows up within 5s, there is nothing to delete
    const row = matchingRows(page, t).first();
    try {
      await expect(row).toBeVisible({ timeout: 5000 });
    } catch {
      return;
    }

    await row.getByLabel('Delete').click();
    await page.getByRole('button', { name: 'Delete' }).click(); // confirm popup
    await expect(page.getByText(DELETE_TOAST)).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }
}

// Remove any old record of this Type, create a fresh one and confirm it is listed.
// The record is kept on purpose, for later call-based testing.
async function createRecord(page, t) {
  await deleteMatching(page, t);

  await page.getByRole('button', { name: 'add advance call-queue mapping' }).click();

  await pick(page, 0, t.type);
  for (const [position, option] of t.selects) {
    await pick(page, position, option);
  }
  for (const [label, value] of t.numbers) {
    await page.getByRole('spinbutton', { name: label }).fill(value);
  }

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled({ timeout: 5000 });
  await save.click();

  await expect(page.getByText(t.toast)).toBeVisible({ timeout: 10000 });
  await expectRows(page, t, 1);
}

// Wait until the Edit form has finished filling itself: the saved campaign is showing, and no
// field has changed for 1.5 seconds. The form loads its values in steps, and a click made too
// early gets overwritten by a late load. (Every record here uses DJ_Auto as its campaign.)
async function waitForFormToSettle(page) {
  const snapshot = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('input, [role="combobox"]')]
        .map((el) => (el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value ?? el.textContent))
        .join('|')
    );
  let last = await snapshot();
  let since = Date.now();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(250);
    const now = await snapshot();
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (now.includes(QUEUE) && Date.now() - since >= 1500) {
      return;
    }
  }
  throw new Error('The Edit form did not finish loading its values within 20 seconds');
}

// Filter to this Type's record and open its Edit form, then wait for the form to finish loading
async function openEdit(page, t, status = 'All') {
  await filterBy(page, t, status);
  const row = matchingRows(page, t).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByLabel('Edit').click();
  await page.waitForLoadState('networkidle');
  await waitForFormToSettle(page);
}

// Click Save on the Edit form, expect the toast, and wait until it is gone so the
// next toast with the same text cannot be mistaken for this one
async function saveEdit(page, t) {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(t.toast)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(t.toast)).toBeHidden({ timeout: 15000 });
}

// ---------- Add ----------

test.describe('Advance Call Management - Add', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAdvanceCallManagement(page);
  });

  for (const t of types) {
    test(`Add mapping - ${t.name}`, async ({ page }) => {
      await createRecord(page, t);
    });
  }
});

// ---------- Edit ----------
// These tests edit the kept record and then put it back exactly as it was.
// If a test fails between the change and the restore, the next Add run replaces the record.

test.describe('Advance Call Management - Edit', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAdvanceCallManagement(page);
  });

  // Only the Types with a time-duration field
  for (const t of types.filter((x) => x.numbers.length > 0)) {
    const [label, original] = t.numbers[0];

    test(`Edit time duration - ${t.name}`, async ({ page }) => {
      const field = page.getByRole('spinbutton', { name: label });

      // Change it: wait until the form has loaded the saved value, so it can't overwrite ours
      await openEdit(page, t);
      await expect(field).toHaveValue(original);
      await setNumber(field, EDIT_DURATION);
      await expect(field).toHaveValue(EDIT_DURATION);   // our value is really in the field
      await saveEdit(page, t);

      // The new value was really saved
      await openEdit(page, t);
      await expect(field).toHaveValue(EDIT_DURATION);

      // Put the original back
      await setNumber(field, original);
      await expect(field).toHaveValue(original);
      await saveEdit(page, t);
    });
  }

  // All Types have a Status (Enable / Disable)
  for (const t of types) {
    test(`Disable and enable - ${t.name}`, async ({ page }) => {
      // Disable
      await openEdit(page, t);
      await expect(page.getByRole('radio', { name: 'Enable' })).toBeChecked();   // form loaded, record is enabled
      await page.getByRole('radio', { name: 'Disable' }).check();
      await expect(page.getByRole('radio', { name: 'Disable' })).toBeChecked();
      await saveEdit(page, t);

      // The status filter starts on Enable, so the disabled record is hidden there...
      await expectRows(page, t, 0, 'Enable');
      // ...and shows up when the filter is set to Disable
      await expectRows(page, t, 1, 'Disable');

      // Open it from the Disable filter and confirm it really is disabled
      await openEdit(page, t, 'Disable');
      await expect(page.getByRole('radio', { name: 'Disable' })).toBeChecked();

      // Enable again
      await page.getByRole('radio', { name: 'Enable' }).check();
      await expect(page.getByRole('radio', { name: 'Enable' })).toBeChecked();
      await saveEdit(page, t);

      // Back under the Enable filter
      await expectRows(page, t, 1, 'Enable');
    });
  }
});

// ---------- Bulk delete ----------
// Runs last. It deletes the kept records of two Types together, then re-creates them.

test.describe('Advance Call Management - Bulk delete', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAdvanceCallManagement(page);
  });

  test('Bulk delete two mappings', async ({ page }) => {
    // Two Types that use the Queue filter, so both rows show up under Queue = DJ_Auto
    const targets = types.filter((x) => ['Callback', 'Feedback'].includes(x.listType));

    // Make sure both records exist
    for (const t of targets) {
      await createRecord(page, t);
    }

    // Show every DJ_Auto record. createRecord leaves a Type filter applied (the list then shows
    // only the last Type created), so reload the page to clear it and filter by Queue alone.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(async () => {
      await filterByQueue(page);
      await page.getByRole('button', { name: 'Apply' }).click();
      await page.waitForLoadState('networkidle');
      for (const t of targets) {
        await expect(matchingRows(page, t)).toHaveCount(1, { timeout: 5000 });
      }
    }).toPass({ timeout: 30000 });

    // Tick the first-cell checkbox of each target row
    for (const t of targets) {
      await matchingRows(page, t).first().locator('td').first().getByRole('checkbox').check();
    }

    // The bulk Delete button is the toolbar button right after the "add" button
    await page
      .getByRole('button', { name: 'add advance call-queue mapping' })
      .locator('xpath=following-sibling::button[1]')
      .click();
    await page.getByRole('button', { name: 'Delete' }).click(); // confirm popup
    await expect(page.getByText(DELETE_TOAST)).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Both are gone
    for (const t of targets) {
      await expectRows(page, t, 0);
    }

    // Put the records back for call testing
    for (const t of targets) {
      await createRecord(page, t);
    }
  });
});