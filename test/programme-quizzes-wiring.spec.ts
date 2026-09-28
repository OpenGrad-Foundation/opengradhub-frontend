import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { qk } from '../lib/queries/keys';

/**
 * Wiring for the programme-derived Quizzes tab.
 *
 * The failure modes here are all silent. A `programme_id` that does not reach
 * the query key serves a stale unfiltered list forever. Deciding programme mode
 * from the raw `/programmes` response classifies every PROGRAM_MANAGER as a
 * member — the backend returns the whole catalogue to that role with
 * `my_level: null` — and then offers picker options the API answers with a 404.
 * Neither looks wrong in review.
 */

const PAGE = path.join(__dirname, '..', 'app', 'dashboard', 'assessments', 'page.tsx');
const page = fs.readFileSync(PAGE, 'utf-8');

describe('assessments-overview query key', () => {
  it('separates a programme-filtered list from the unfiltered one', () => {
    const unfiltered = qk.assessmentsOverview({});
    const filtered   = qk.assessmentsOverview({ programme_id: 'p1' });
    expect(filtered).not.toEqual(unfiltered);
  });

  it('separates two programmes from each other', () => {
    expect(qk.assessmentsOverview({ programme_id: 'p1' }))
      .not.toEqual(qk.assessmentsOverview({ programme_id: 'p2' }));
  });
});

describe('the monitor view uses effective scope and backend programme reach', () => {
  it('keeps backend-reachable programmes including assigned-batch nonmembers', () => {
    expect(page).not.toMatch(/allProgrammes\.filter\(\(p\) => p\.is_member\)/);
    expect(page).toMatch(/myProgrammes = allProgrammes/);
  });

  it('uses effective unrestricted scope for the broad picker', () => {
    expect(page).toContain('has(PERM.scope.unrestricted)');
    expect(page).toMatch(/inProgrammeMode = !isUnrestricted/);
  });

  it('sends programme_id through to the overview query', () => {
    expect(page).toMatch(/programme_id: programmeId \|\| undefined/);
  });

  it('hides the Program type filter in programme mode', () => {
    // A programme reaches quizzes only through the courses it owns, and a course
    // quiz is always MODULE_TEST — the segment could only ever return nothing.
    expect(page).toMatch(/!inProgrammeMode && \(\s*\n\s*<SegBtn label="Program"/);
  });

  it('offers an all-programmes option that sends no filter', () => {
    expect(page).toMatch(/<option value="">\{isUnrestricted \? 'All programmes'/);
  });

  it('points an empty programme list at the content tab instead of falling back', () => {
    expect(page).toMatch(/none of this programme/);
    expect(page).toMatch(/dashboard\/programmes\/\$\{programmeId \|\| myProgrammes\[0\]\?\.id/);
  });
});

describe('the row labels its owning programme', () => {
  it('prefixes the label with programme_name when the backend supplied one', () => {
    expect(page).toMatch(/item\.programme_name \? `\$\{item\.programme_name\} · \$\{base\}` : base/);
  });
});
