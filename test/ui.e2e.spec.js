'use strict';

import { test, expect } from '@playwright/test';

async function login(page, user = 'student1', pass = 'student1') {
  await page.goto('/');
  await page.fill('#login-user', user);
  await page.fill('#login-pass', pass);
  await page.click('button.btn:has-text("Sign in")');
  await expect(page.locator('#mission .steps')).toBeVisible();
}

test.describe('Mission Console — the self-paced storyline in the UI', () => {
  test('Act 0 briefing: mission title and four recon links render on the landing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mission-title')).toHaveText('The Semester Heist');
    const recon = page.locator('.recon-links a');
    await expect(recon).toHaveCount(4);
    await expect(page.getByRole('link', { name: /Service status/ })).toHaveAttribute('href', '/status');
    await expect(page.getByRole('link', { name: /Legacy API/ })).toHaveAttribute('href', '/api/v0/students/1');
  });

  test('login opens the mission at Act 3, earlier acts done, later acts locked and un-skippable', async ({ page }) => {
    await login(page);
    const steps = page.locator('#mission .step');
    await expect(steps).toHaveCount(7);
    await expect(steps.nth(0)).toHaveClass(/done/);
    await expect(steps.nth(1)).toHaveClass(/done/);
    await expect(steps.nth(2)).toHaveClass(/active/);
    await expect(steps.nth(3)).toHaveClass(/locked/);
    await expect(steps.nth(6)).toHaveClass(/locked/);

    // Locked acts expose no action buttons — you cannot skip ahead.
    await expect(steps.nth(3).locator('.btn')).toHaveCount(0);
    // The active act shows its objective, a "look for" hint, and controls.
    await expect(steps.nth(2).locator('.step-hint')).toBeVisible();
    await expect(steps.nth(2).locator('.btn.solid')).toBeVisible();
    await expect(page.locator('#progress-chip')).toContainText('Act 3 of 7');
  });

  test('completing each act unlocks exactly the next, through to the finish', async ({ page }) => {
    await login(page);
    for (let n = 3; n <= 7; n++) {
      const active = page.locator('#mission .step.active');
      await expect(active).toContainText(`Act ${n} ·`);
      await active.locator('.btn.solid').click();
    }
    await expect(page.locator('.mission-done')).toBeVisible();
    await expect(page.locator('#mission .step.locked')).toHaveCount(0);
    await expect(page.locator('#mission .step.done')).toHaveCount(7);
    await expect(page.locator('#progress-chip')).toContainText('complete');
  });

  test('progress persists across reload and Reset clears it', async ({ page }) => {
    await login(page);
    // Finish Act 3 -> Act 4 becomes active.
    await page.locator('#mission .step.active .btn.solid').click();
    await expect(page.locator('#mission .step.active')).toContainText('Act 4 ·');

    // Reload, then log back in: persisted progress should resume at Act 4.
    await page.reload();
    await login(page);
    await expect(page.locator('#mission .step.active')).toContainText('Act 4 ·');

    // Reset returns to the start of the path.
    await page.click('button:has-text("Reset progress")');
    await expect(page.locator('#mission .step.active')).toContainText('Act 1 ·');
    await expect(page.locator('.progress-label')).toContainText('0 of 7');
  });

  test('a real vulnerability drives through the UI: mass assignment elevates the session role', async ({ page }) => {
    await login(page);
    await page.click('.tabs button:has-text("Profile")');
    await page.fill('#profile-patch', JSON.stringify({ role: 'faculty' }));
    await page.click('button.btn:has-text("Save changes")');
    await expect(page.locator('#session')).toContainText('faculty');
  });

  test('XSS-1: a stored announcement executes script in the viewer\'s browser', async ({ page }) => {
    await login(page);
    await page.click('.tabs button:has-text("Courses")');
    // Post an announcement whose rendered HTML runs script when displayed.
    const marker = 'xss_' + Date.now();
    await page.fill('#ann-body', `<img src=x onerror="window.__xss='${marker}'">`);
    await page.click('button.btn:has-text("Post")');
    // The board reloads and injects the announcement HTML; the handler fires.
    await page.waitForFunction((m) => window.__xss === m, marker, { timeout: 5000 });
    const fired = await page.evaluate(() => window.__xss);
    expect(fired).toBe(marker);
  });
});
