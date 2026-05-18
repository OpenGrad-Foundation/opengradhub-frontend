/**
 * Playwright auth setup — runs once before any journey spec.
 *
 * Logs in as each test role using Clerk testing tokens and saves the browser
 * storage state so journey specs can start already authenticated.
 *
 * Required env vars (GitHub Secrets / .env.test.local):
 *   CLERK_SECRET_KEY        — test Clerk secret key (sk_test_...)
 *   E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD
 *   E2E_PM_EMAIL    / E2E_PM_PASSWORD   (Program Manager)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (Super Admin)
 *
 * Storage state is written to e2e/.auth/ which is gitignored.
 */

import { test as setup, expect } from '@playwright/test';
import { clerkSetup } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';

const authDir = path.join(process.cwd(), 'e2e', '.auth');

setup.beforeAll(async () => {
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  await clerkSetup();
});

// ── Student ───────────────────────────────────────────────────────────────────

setup('authenticate as student', async ({ page, context }) => {
  setup.skip(
    !process.env.E2E_STUDENT_EMAIL,
    'E2E_STUDENT_EMAIL not set — skipping student auth setup',
  );

  await signIn(page, process.env.E2E_STUDENT_EMAIL!, process.env.E2E_STUDENT_PASSWORD!);
  await page.waitForURL('**/dashboard**');
  await context.storageState({ path: path.join(authDir, 'student.json') });
});

// ── Program Manager ───────────────────────────────────────────────────────────

setup('authenticate as program manager', async ({ page, context }) => {
  setup.skip(
    !process.env.E2E_PM_EMAIL,
    'E2E_PM_EMAIL not set — skipping program manager auth setup',
  );

  await signIn(page, process.env.E2E_PM_EMAIL!, process.env.E2E_PM_PASSWORD!);
  await page.waitForURL('**/dashboard**');
  await context.storageState({ path: path.join(authDir, 'program-manager.json') });
});

// ── Super Admin ───────────────────────────────────────────────────────────────

setup('authenticate as super admin', async ({ page, context }) => {
  setup.skip(
    !process.env.E2E_ADMIN_EMAIL,
    'E2E_ADMIN_EMAIL not set — skipping admin auth setup',
  );

  await signIn(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.waitForURL('**/dashboard**');
  await context.storageState({ path: path.join(authDir, 'admin.json') });
});

// ── Shared sign-in helper ─────────────────────────────────────────────────────

async function signIn(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/sign-in');
  // Clerk's hosted sign-in component
  await page.locator('input[name=identifier]').fill(email);
  await page.locator('button.cl-formButtonPrimary').first().click();
  await page.locator('input[name=password]').fill(password);
  await page.locator('button.cl-formButtonPrimary').first().click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}
