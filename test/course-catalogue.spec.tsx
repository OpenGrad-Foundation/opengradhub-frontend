import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Course, CourseListParams, PaginatedCoursesResponse } from '@/lib/api';
import CourseCatalogue from '@/app/dashboard/courses/_components/CourseCatalogue';

const api = vi.fn();
let permissions: string[];
let rows: Course[];
const personalCourses = vi.fn();
vi.mock('@/lib/api', () => ({ getCoursesPage: (params: CourseListParams) => api(params) }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'pm' }, permissions }, isLoading: false }) }));
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({ has: (code: string) => permissions.includes(code) }) }));
vi.mock('@/lib/queries/students', () => ({ useStudentCourses: (id: string) => { personalCourses(id); return { data: [], isLoading: false }; } }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/courses', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn() }) }));

const course = (id: string, extras: Partial<Course> = {}): Course => ({ id, title: `Course ${id}`, description: 'Course description', programme_type: 'UG', status: 'ACTIVE', access_type: 'FREE', locking_mode: 'OPEN', lesson_count: 6, quiz_count: 2, tags: [], created_by: 'pm', created_at: '2026-09-01', cover_image_url: null, can_manage: true, can_edit_content: true, ...extras });
const response = (items: Course[], page = 1, size = 6): PaginatedCoursesResponse => ({ items: items.slice((page - 1) * size, page * size), total: items.length, page, page_size: size, total_pages: Math.max(1, Math.ceil(items.length / size)), has_next: page * size < items.length, has_prev: page > 1 });

beforeEach(() => {
  permissions = ['courses.view', 'courses.edit', 'courses.create', 'scope.programme_all'];
  rows = [course('managed'), course('editable', { can_manage: false }), course('readonly', { can_manage: false, can_edit_content: false }), course('draft', { status: 'DRAFT' })];
  api.mockReset().mockImplementation(async (params: CourseListParams) => response(rows.filter(row => (!params.status || row.status === params.status) && (!params.search || row.title.includes(params.search))), params.page, params.pageSize));
  personalCourses.mockClear();
});

describe('course catalogue', () => {
  it('makes each card one link while preserving its management authority', async () => {
    render(<CourseCatalogue />);
    const managed = await screen.findByRole('link', { name: /Course managed/ });
    expect(managed.getAttribute('href')).toContain('/dashboard/course-management/managed');
    expect(screen.getByRole('link', { name: /Course editable/ }).getAttribute('href')).toContain('/dashboard/course-management/editable');
    expect(screen.getByRole('link', { name: /Course readonly/ }).getAttribute('href')).toContain('/dashboard/courses/readonly');
    expect(within(managed).queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByRole('combobox', { name: 'Programme' })).toBeNull();
  });

  it('changes statuses with both keyboard tabs and the compact picker', async () => {
    render(<CourseCatalogue />);
    await screen.findByRole('link', { name: /Course managed/ });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Published' }), { key: 'ArrowRight' });
    await screen.findByRole('link', { name: /Course draft/ });
    expect(screen.getByRole('tab', { name: 'Drafts' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByRole('combobox', { name: 'Course status' }), { target: { value: 'ARCHIVED' } });
    await screen.findByRole('heading', { name: 'No archived courses' });
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ status: 'ARCHIVED', pageSize: 6 }));
  });

  it('reveals filters, submits their values, and clears them', async () => {
    render(<CourseCatalogue />);
    await screen.findByRole('link', { name: /Course managed/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Programme' }), { target: { value: 'CAT' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tags' }), { target: { value: 'maths' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tags' }), { key: 'Enter' });
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.objectContaining({ programmeType: 'CAT', tags: ['MATHS'] })));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ programmeType: undefined, tags: undefined, page: 1 })));
  });

  it('paginates and resets the page when changing layout', async () => {
    rows = Array.from({ length: 9 }, (_, index) => course(String(index)));
    render(<CourseCatalogue />);
    await screen.findByRole('link', { name: /Course 0/ });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByRole('link', { name: /Course 6/ });
    expect(screen.queryByRole('link', { name: /Course 0/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await screen.findByRole('table', { name: 'Courses' });
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }));
  });

  it('keeps creation and management views out of the personal catalogue', async () => {
    permissions = ['courses.view', 'scope.self'];
    render(<CourseCatalogue />);
    await screen.findByText('No courses assigned yet.');
    expect(api).not.toHaveBeenCalled();
    expect(personalCourses).toHaveBeenCalledWith('pm');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('link', { name: 'New course' })).toBeNull();
  });

  it('offers a working retry after a failed request', async () => {
    api.mockRejectedValueOnce(new Error('Network unavailable'));
    render(<CourseCatalogue />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: /Course managed/ });
    expect(screen.queryByText('Network unavailable')).toBeNull();
  });

  it('ignores an older response arriving after a newer search', async () => {
    let finishOlder!: (value: PaginatedCoursesResponse) => void;
    api.mockImplementation((params: CourseListParams) => params.pageSize === 1
      ? Promise.resolve(response([]))
      : params.search ? Promise.resolve(response([course('new result')]))
      : new Promise<PaginatedCoursesResponse>(resolve => { finishOlder = resolve; }));
    render(<CourseCatalogue />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'new' } });
    await screen.findByRole('link', { name: /Course new result/ });
    await act(async () => { finishOlder(response([course('stale result')])); });
    expect(screen.queryByRole('link', { name: /Course stale result/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Course new result/ })).toBeTruthy();
  });
});
