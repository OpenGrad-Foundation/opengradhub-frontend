import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The school's "+ Add Batch" panel could only attach a batch that already
 * existed, so creating one meant leaving the school screen, going to
 * /dashboard/batches, creating it, and navigating back. The panel now stacks
 * the batch create slide-over on top of itself instead.
 */
describe('the school attach-batch panel can create a batch without leaving', () => {
  const panel = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'dashboard', 'schools', '[id]', 'AttachBatchPanel.tsx'),
    'utf-8',
  );

  it('reuses the Batches page slide-over rather than a second form', () => {
    expect(panel).toContain('BatchFormModal');
    expect(panel).toMatch(/mode="create"/);
  });

  it('pre-fills this school so the new batch lands here', () => {
    // Without defaultSchoolId the batch is created independent and the user is
    // back where they started: it would not appear on the school page.
    expect(panel).toMatch(/defaultSchoolId=\{schoolId\}/);
  });

  it('gates the opener on batches.create, not on batches.edit', () => {
    // The panel itself opens under batches.edit; creating is a separate grant.
    expect(panel).toContain('PERM.batches.create');
    expect(panel).toMatch(/canCreateBatch && \(/);
  });

  it('returns to the panel with fresh data instead of navigating away', () => {
    expect(panel).not.toMatch(/useRouter|router\.push/);
    const at = panel.indexOf('onSaved={() => {');
    expect(at).toBeGreaterThan(-1);
    const handler = panel.slice(at, at + 320);
    expect(handler).toContain('setShowCreate(false)');
    expect(handler).toContain('loadBatches()');
    expect(handler).toContain('onChanged()');
  });

  it('offers the create shortcut from the empty state too', () => {
    // "No batches available to attach" was a dead end for the exact user who
    // needs to make one.
    expect(panel).toMatch(/Create a new batch for \{schoolName\}/);
  });
});
