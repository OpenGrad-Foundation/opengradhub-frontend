import { test as base, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(process.cwd(), 'e2e', '.auth');

function stateFile(role: string): string {
  return path.join(authDir, `${role}.json`);
}

function stateExists(role: string): boolean {
  return fs.existsSync(stateFile(role));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const test = base.extend<{
  studentPage: import('@playwright/test').Page;
  pmPage: import('@playwright/test').Page;
  adminPage: import('@playwright/test').Page;
}>({
  // A page already authenticated as a student
  studentPage: async ({ browser }, use) => {
    if (!stateExists('student')) {
      throw new Error('Student auth state not found. Run auth.setup.ts first.');
    }
    const ctx = await browser.newContext({ storageState: stateFile('student') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // A page already authenticated as a program manager
  pmPage: async ({ browser }, use) => {
    if (!stateExists('program-manager')) {
      throw new Error('Program manager auth state not found. Run auth.setup.ts first.');
    }
    const ctx = await browser.newContext({ storageState: stateFile('program-manager') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // A page already authenticated as super admin
  adminPage: async ({ browser }, use) => {
    if (!stateExists('admin')) {
      throw new Error('Admin auth state not found. Run auth.setup.ts first.');
    }
    const ctx = await browser.newContext({ storageState: stateFile('admin') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };
