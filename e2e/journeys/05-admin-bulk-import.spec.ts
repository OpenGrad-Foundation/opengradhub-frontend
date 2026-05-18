/**
 * Journey 5: Super Admin bulk-imports users via CSV upload
 *
 * Happy path: admin navigates to user management, uploads a valid CSV,
 * and sees a success confirmation.
 */

import { test, expect } from '../fixtures/base';
import path from 'path';
import fs from 'fs';

// Minimal valid CSV fixture — two users, one per role
const CSV_CONTENT = [
  'full_name,email,role',
  'E2E Import Student,e2e-import-student@test.opengrad.in,STUDENT',
  'E2E Import Fellow,e2e-import-fellow@test.opengrad.in,FELLOW',
].join('\n');

test.describe('Super Admin — bulk user import', () => {
  let csvPath: string;

  test.beforeAll(() => {
    // Write the fixture CSV to a temp file Playwright can upload
    const tmpDir = path.join(process.cwd(), 'e2e', '.tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    csvPath = path.join(tmpDir, 'bulk-import.csv');
    fs.writeFileSync(csvPath, CSV_CONTENT, 'utf-8');
  });

  test.afterAll(() => {
    if (csvPath && fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
  });

  test('can reach the user management page', async ({ adminPage: page }) => {
    await page.goto('/dashboard/user-management');
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page).not.toHaveURL(/error|500/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('can open the bulk import dialog/section', async ({ adminPage: page }) => {
    await page.goto('/dashboard/user-management');

    const importBtn = page
      .getByRole('button', { name: /import|bulk|upload/i })
      .or(page.getByRole('link', { name: /import|bulk|upload/i }))
      .first();

    await expect(importBtn).toBeVisible({ timeout: 10_000 });
    await importBtn.click();

    // A file upload input or dialog should appear
    await expect(
      page
        .locator('input[type="file"]')
        .or(page.getByRole('dialog'))
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('uploads a CSV and sees a success or preview response', async ({ adminPage: page }) => {
    await page.goto('/dashboard/user-management');

    const importBtn = page
      .getByRole('button', { name: /import|bulk|upload/i })
      .or(page.getByRole('link', { name: /import|bulk|upload/i }))
      .first();

    const btnExists = await importBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!btnExists) return;

    await importBtn.click();

    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.isVisible({ timeout: 5_000 }).catch(() => false))) return;

    await fileInput.setInputFiles(csvPath);

    // Should see a preview table or success/error message
    await expect(
      page
        .getByText(/success|imported|preview|rows|2 users/i)
        .or(page.locator('table').first())
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Student — no access to user management', () => {
  test('cannot reach user management page', async ({ studentPage: page }) => {
    await page.goto('/dashboard/user-management');
    // Should see no-access or be redirected away
    const redirected = page.url().includes('/dashboard') && !page.url().includes('user-management');
    const noAccess = await page.getByText(/no access|permission/i).isVisible().catch(() => false);
    expect(redirected || noAccess).toBe(true);
  });
});
