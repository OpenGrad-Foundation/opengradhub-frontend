import { describe, it, expect } from 'vitest';
import { qk } from '../lib/queries/keys';
import { PERM, ROUTE_PERMISSION } from '../lib/permissions';
import { MODULE_META } from '../lib/moduleAccess';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Wiring for the programmes admin surface.
 *
 * These are the joins that fail silently rather than loudly: a nav entry with
 * no permission gate renders a link that 403s, and an invalidation prefix that
 * does not match its query key leaves stale data on screen after a write. Both
 * look fine in review and only surface in use.
 */

describe('programme query keys', () => {
  it('keys the list by the archived flag so the two lists cannot collide', () => {
    expect(qk.programmes(false)).toEqual(['og', 'programmes', { includeArchived: false }]);
    expect(qk.programmes(true)).toEqual(['og', 'programmes', { includeArchived: true }]);
    expect(qk.programmes(false)).not.toEqual(qk.programmes(true));
  });

  it('nests detail keys under the programme so one prefix drops them all', () => {
    // The mutation hooks invalidate ['og','programme',id]; members, schools and
    // content must sit UNDER that prefix or they survive a write that changed them.
    const id = 'p1';
    expect(qk.programme(id)).toEqual(['og', 'programme', id]);
    expect(qk.programmeMembers(id).slice(0, 3)).toEqual(qk.programme(id));
    expect(qk.programmeSchools(id).slice(0, 3)).toEqual(qk.programme(id));
    expect(qk.programmeContent(id).slice(0, 3)).toEqual(qk.programme(id));
    expect(qk.programmeAssignable(id, 'courses', '').slice(0, 3)).toEqual(qk.programme(id));
  });

  it('keys the assignable picker by kind and search, so the two lists cannot collide', () => {
    expect(qk.programmeAssignable('p1', 'courses', ''))
      .not.toEqual(qk.programmeAssignable('p1', 'assignments', ''));
    expect(qk.programmeAssignable('p1', 'courses', 'a'))
      .not.toEqual(qk.programmeAssignable('p1', 'courses', 'b'));
  });

  it('keeps the list key distinct from the detail key', () => {
    expect(qk.programmes(false)[1]).toBe('programmes');
    expect(qk.programme('p1')[1]).toBe('programme');
  });
});

describe('programme permissions', () => {
  it('exposes the three backend permission codes verbatim', () => {
    expect(PERM.programmes.view).toBe('programmes.view');
    expect(PERM.programmes.edit).toBe('programmes.edit');
    expect(PERM.programmes.manage_members).toBe('programmes.manage_members');
  });

  it('gates the route on view, not on edit', () => {
    // FELLOW and ZM hold only programmes.view — gating the route on edit would
    // hide the page from members who are meant to see their own programmes.
    expect(ROUTE_PERMISSION.programmes).toBe(PERM.programmes.view);
  });
});

describe('programme nav entry', () => {
  it('is registered and points at the real route', () => {
    expect(MODULE_META.programmes).toEqual({
      label: 'Programmes',
      href: '/dashboard/programmes',
    });
  });

  it('has a permission gate — an ungated nav entry renders a link that 403s', () => {
    const key = MODULE_META.programmes.href.replace('/dashboard/', '');
    expect(ROUTE_PERMISSION[key]).toBeDefined();
  });
});

describe('the programmes nav entry actually renders', () => {
  const sidebar = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'sidebar.tsx'),
    'utf-8',
  );

  it('has an icon — MODULE_ICONS is keyed by module, and a miss renders no glyph', () => {
    // `{Icon && ...}` means a missing entry fails silently: the row keeps its
    // label but loses its icon, and in the collapsed rail it becomes invisible.
    expect(sidebar).toMatch(/programmes:\s+\w+,/);
  });

  it('imports the icon it names', () => {
    const named = sidebar.match(/programmes:\s+(\w+),/)?.[1];
    expect(named, 'no icon mapped for programmes').toBeTruthy();
    expect(sidebar).toMatch(new RegExp(`^\\s+${named},$`, 'm'));
  });
});

describe('content writes invalidate outside the programme family', () => {
  const mutations = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'mutations', 'programmes.ts'),
    'utf-8',
  );

  it('drops the course caches — assignment changes can_manage on the course list', () => {
    // Membership/school writes are self-contained; content writes are not.
    // Without this an EDITOR who was just granted a course keeps seeing it
    // read-only until the cache happens to expire.
    const fn = mutations.slice(mutations.indexOf('function useProgrammeContentInvalidation'));
    expect(fn).toMatch(/'og', 'courses'/);
    expect(fn).toMatch(/qk\.assignments\(\)/);
  });

  it('both content mutations use it', () => {
    for (const hook of ['useAssignProgrammeContent', 'useReleaseProgrammeContent']) {
      const at = mutations.indexOf(`export function ${hook}`);
      expect(at, `${hook} not found`).toBeGreaterThan(-1);
      expect(mutations.slice(at, at + 400)).toContain('useProgrammeContentInvalidation');
    }
  });
});

describe('the list-page notice describes the grant that exists', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'dashboard', 'programmes', 'page.tsx'),
    'utf-8',
  );

  it('no longer claims membership grants nothing', () => {
    // It said "Not wired to access yet" for one release after the content-edit
    // resolver shipped. A banner that understates a grant is worse than none.
    expect(page).not.toMatch(/not wired to access/i);
    expect(page).not.toMatch(/does not currently grant/i);
  });

  it('states both halves — what it grants and what it never grants', () => {
    expect(page).toMatch(/EDITOR/);
    expect(page).toMatch(/never grants student data/i);
  });
});
