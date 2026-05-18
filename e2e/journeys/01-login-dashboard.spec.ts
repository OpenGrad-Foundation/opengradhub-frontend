/**
 * Journey 1: Login + role-correct dashboard
 *
 * Each role must land on their own dashboard after login and see
 * role-appropriate navigation.
 */

import { test, expect } from '../fixtures/base';

test.describe('Student — login and dashboard', () => {
  test('lands on dashboard after sign-in and sees expected nav', async ({ studentPage: page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/sign-in/);
    // Should see the courses link in nav (students have courses.view)
    await expect(page.getByRole('link', { name: /courses/i }).first()).toBeVisible();
  });

  test('is redirected to /sign-in when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in|^\/$/, { timeout: 10_000 });
  });
});

test.describe('Program Manager — login and dashboard', () => {
  test('lands on dashboard and can see course management nav', async ({ pmPage: page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/sign-in/);
    // PM should see course management in sidebar
    await expect(
      page.getByRole('link', { name: /course.management|manage.course/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Super Admin — login and dashboard', () => {
  test('can see user management nav item', async ({ adminPage: page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(
      page.getByRole('link', { name: /user.management/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
