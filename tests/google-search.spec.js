import { test, expect } from '@playwright/test';

test('Open Google and search for Wikipedia', async ({ page }) => {
  // 1. Navigate to Google
  await page.goto('https://www.google.com');

  // 2. Handle Google cookie/consent dialog if prompted
  const consentButton = page.getByRole('button', { name: /accept all|agree|reject all|i agree/i });
  try {
    if (await consentButton.isVisible({ timeout: 2000 })) {
      await consentButton.click();
    }
  } catch (e) {
    // Consent popup not present
  }

  // 3. Find the search input and search for "wikipedia"
  const searchInput = page.locator('textarea[name="q"], input[name="q"]');
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  await searchInput.fill('wikipedia');
  await searchInput.press('Enter');

  // 4. Verify search results contain Wikipedia link
  const wikipediaLink = page.getByRole('link', { name: /wikipedia/i }).first();
  await expect(wikipediaLink).toBeVisible({ timeout: 10000 });

  // 5. Click Wikipedia and verify navigation
  await wikipediaLink.click();
  await expect(page).toHaveURL(/wikipedia\.org/, { timeout: 10000 });
});
