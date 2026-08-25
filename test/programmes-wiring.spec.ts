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

  it('drops the resources cache too — resources are a content kind since 095', () => {
    const fn = mutations.slice(mutations.indexOf('function useProgrammeContentInvalidation'));
    expect(fn).toMatch(/'og', 'resources'/);
  });

  it('a resource write drops the programme caches, since retargeting changes editability', () => {
    // The closure is evaluated over the resource's TARGETS, so editing those
    // can flip the Content tab's `editable` column and empty the assignable
    // picker. One-way invalidation would leave the programme screen asserting
    // an edit right the server no longer grants.
    const invalidation = fs.readFileSync(
      path.join(__dirname, '..', 'lib', 'mutations', 'invalidation.ts'),
      'utf-8',
    );
    const at = invalidation.indexOf('resources:');
    expect(at).toBeGreaterThan(-1);
    expect(invalidation.slice(at, at + 120)).toMatch(/'og', 'programme'/);
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

describe('the member picker does not need a permission its users lack', () => {
  const detail = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'dashboard', 'programmes', '[id]', 'page.tsx'),
    'utf-8',
  );

  it('uses the ownership-gated endpoint, not GET /users', () => {
    // GET /users requires user_management.view, held only by SUPER_ADMIN. A
    // PROGRAM_MANAGER holds programmes.manage_members but not that, so the
    // picker 403'd for exactly the role that staffs programmes — and the error
    // was swallowed, leaving an empty dropdown and no explanation.
    expect(detail).toContain('useEligibleProgrammeMembers');
    expect(detail).not.toMatch(/\bgetUsers\b/);
  });

  it('says so when the staff list fails instead of showing an empty dropdown', () => {
    expect(detail).toMatch(/staffError/);
  });

  it('does not promise EDITORs control over what the programme owns', () => {
    // EDITOR edits content; deciding WHICH content the programme owns is OWNER
    // only. "Manages the programme's content" implied both.
    expect(detail).not.toMatch(/EDITOR:\s*"Manages the programme's content\."/);
    expect(detail).toMatch(/EDITOR:\s*"Can edit the courses, assignments and resources/);
  });

  it('tells an archived programme’s owner that they can undo it', () => {
    // levelFor stops at ARCHIVED but administration does not, so the old
    // "grants nothing" wording described a lockout that no longer happens.
    expect(detail).not.toMatch(/Membership grants nothing while it stays archived/);
    expect(detail).toMatch(/Owners keep administrative access/);
  });
});

describe('the courses list routes on the right authority', () => {
  const coursesPage = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'dashboard', 'courses', 'page.tsx'),
    'utf-8',
  );

  it('sends Manage to the management view only for can_manage', () => {
    // /dashboard/course-management is gated by canManageCourse, which excludes
    // programme editors. Routing them there on can_edit_content was a 403.
    expect(coursesPage).toMatch(/const manageable = canManage && course\.can_manage !== false/);
    expect(coursesPage).toMatch(/can_edit_content/);
  });

  it('gives the content grant a way in — badge alone is a dead end', () => {
    // A programme EDITOR holds can_edit_content but not can_manage. The card
    // used to show a "Content edit" badge while the only button said "Open"
    // and led to the student view — the grant existed but had no entry point.
    // The management page degrades to a content-only workspace on the
    // management-payload 403, so routing editors there is safe now.
    expect(coursesPage).toMatch(
      /manageable \|\| editableContent \? `\/dashboard\/course-management\/\$\{course\.id\}`/,
    );
    expect(coursesPage).toMatch(/"Edit content"/);
  });
});

describe('resources are a first-class content kind', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'dashboard', 'programmes', '[id]', 'page.tsx'),
    'utf-8',
  );

  it('offers all three kinds in the picker', () => {
    const kinds = page.slice(page.indexOf('const KINDS'), page.indexOf('const KIND_ROW_LABEL'));
    for (const k of ['courses', 'assignments', 'resources']) {
      expect(kinds, `${k} missing from KINDS`).toContain(`"${k}"`);
    }
  });

  it('labels rows from a lookup, not a two-way ternary', () => {
    // A ternary silently labelled every non-course row "Assignment", so adding
    // a third kind would have mislabelled every resource rather than failing.
    expect(page).toContain('KIND_ROW_LABEL[c.kind]');
    expect(page).not.toMatch(/c\.kind === "courses" \? "Course" : "Assignment"/);
  });
});

describe('the resources list is not persisted to disk', () => {
  it('has no IDB persister — the response is per-user', () => {
    // Filtered by the caller's batches and school, and carrying per-row
    // can_edit. Persisted under a cohort key it outlives the session and
    // serves one user's rows to the next on a shared device.
    const q = fs.readFileSync(
      path.join(__dirname, '..', 'lib', 'queries', 'resources.ts'),
      'utf-8',
    );
    expect(q).not.toContain('makeIdbPersister');
  });
});

describe('resource actions are gated on the server answer, not the permission alone', () => {
  it('ANDs the per-row flag into canEdit and canDelete', () => {
    const page = fs.readFileSync(
      path.join(__dirname, '..', 'app', 'dashboard', 'resources', 'page.tsx'),
      'utf-8',
    );
    expect(page).toContain('resource.can_edit');
    expect(page).toContain('resource.can_delete');
  });
});
