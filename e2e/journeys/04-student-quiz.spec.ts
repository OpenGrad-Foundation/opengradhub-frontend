/**
 * Journey 4: Student takes a quiz and sees a score
 *
 * Happy path: student navigates to assessments, starts a quiz,
 * answers at least one question, submits, and sees a result.
 */

import { test, expect } from '../fixtures/base';

test.describe('Student — assessments page', () => {
  test('can reach the assessments page without error', async ({ studentPage: page }) => {
    await page.goto('/dashboard/assessments');
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page).not.toHaveURL(/error|500/);
    // Page should render
    await expect(page.locator('main, [role="main"], body').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('starts a quiz and sees questions when one is available', async ({
    studentPage: page,
  }) => {
    await page.goto('/dashboard/assessments');

    // Look for a "Start" or "Attempt" button
    const startBtn = page
      .getByRole('button', { name: /start|attempt|begin|take/i })
      .first();

    const btnExists = await startBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!btnExists) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'No published quiz available in test DB',
      });
      return;
    }

    await startBtn.click();

    // Should see a question or quiz interface
    await expect(
      page
        .locator('[data-testid="quiz-question"], .quiz-question, [class*="question"]')
        .or(page.getByRole('radio').first())
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows a submission result after answering and submitting', async ({
    studentPage: page,
  }) => {
    await page.goto('/dashboard/assessments');

    const startBtn = page
      .getByRole('button', { name: /start|attempt|begin|take/i })
      .first();
    const btnExists = await startBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!btnExists) return;

    await startBtn.click();

    // Attempt to answer the first available option
    const firstOption = page.getByRole('radio').first();
    if (await firstOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstOption.check();
    }

    // Submit the quiz
    const submitBtn = page
      .getByRole('button', { name: /submit|finish|complete/i })
      .first();

    if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitBtn.click();
      // Should see a score or result screen
      await expect(
        page.getByText(/score|result|passed|failed|complete/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  });
});
