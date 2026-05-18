/**
 * Journey 2: Program Manager creates and publishes a course
 *
 * Happy path: PM navigates to course management, fills the create-course form,
 * submits it, and the new course appears in the list.
 */

import { test, expect } from '../fixtures/base';

const TEST_COURSE_TITLE = `E2E Test Course ${Date.now()}`;

test.describe('Program Manager — create course', () => {
  test('can navigate to course management', async ({ pmPage: page }) => {
    await page.goto('/dashboard/course-management');
    await expect(page).not.toHaveURL(/sign-in/);
    // Page should load without error
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });
  });

  test('can open the create-course form', async ({ pmPage: page }) => {
    await page.goto('/dashboard/course-management');
    // Look for a "Create" or "New course" CTA button
    const createBtn = page
      .getByRole('button', { name: /create|new course/i })
      .or(page.getByRole('link', { name: /create|new course/i }))
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    // A form or dialog should appear
    await expect(
      page.getByRole('dialog').or(page.locator('form')).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('submits the create-course form and sees the new course', async ({ pmPage: page }) => {
    await page.goto('/dashboard/course-management');

    const createBtn = page
      .getByRole('button', { name: /create|new course/i })
      .or(page.getByRole('link', { name: /create|new course/i }))
      .first();
    await createBtn.click();

    // Fill title field — use the first visible text input in the form
    const titleInput = page
      .getByRole('textbox', { name: /title/i })
      .or(page.locator('input[placeholder*="title" i]'))
      .first();
    await titleInput.fill(TEST_COURSE_TITLE);

    // Submit
    await page
      .getByRole('button', { name: /save|submit|create/i })
      .first()
      .click();

    // The course should appear somewhere on the page after creation
    await expect(page.getByText(TEST_COURSE_TITLE)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Student — no access to course management', () => {
  test('is shown a no-access state on the course management page', async ({ studentPage: page }) => {
    await page.goto('/dashboard/course-management');
    // Either redirected away or shown "No access"
    const noAccess = page.getByText(/no access|permission|not authorized/i).first();
    const redirectedToDashboard = page.url().endsWith('/dashboard');
    const hasNoAccess = (await noAccess.isVisible().catch(() => false)) || redirectedToDashboard;
    expect(hasNoAccess).toBe(true);
  });
});
