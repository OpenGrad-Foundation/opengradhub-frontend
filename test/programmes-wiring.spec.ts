import { describe, it, expect } from 'vitest';
import { qk } from '../lib/queries/keys';
import { PERM, ROUTE_PERMISSION } from '../lib/permissions';
import { MODULE_META } from '../lib/moduleAccess';

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
    // The mutation hooks invalidate ['og','programme',id]; members and schools
    // must sit UNDER that prefix or they survive a write that changed them.
    const id = 'p1';
    expect(qk.programme(id)).toEqual(['og', 'programme', id]);
    expect(qk.programmeMembers(id).slice(0, 3)).toEqual(qk.programme(id));
    expect(qk.programmeSchools(id).slice(0, 3)).toEqual(qk.programme(id));
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
