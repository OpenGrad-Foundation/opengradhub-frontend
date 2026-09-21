import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CourseManagementPage from '@/app/dashboard/course-management/[id]/page';
import CourseCurriculumEditor from '@/app/dashboard/course-management/_components/CourseCurriculumEditor';
import { ApiError } from '@/lib/api';

const mocks = vi.hoisted(() => ({ summary: vi.fn(), analytics: vi.fn(), curriculum: vi.fn(), students: vi.fn(), course: vi.fn(), modules: vi.fn(), createModule: vi.fn(), updateLesson: vi.fn(), updateCourse: vi.fn(), invalidate: vi.fn(), replace: vi.fn(), push: vi.fn() }));
let permissions: string[];
let query = '';
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'course-one' }), useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'manager' }, role: { code: 'PROGRAM_MANAGER' } }, isLoading: false }) }));
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({ has: (permission: string) => permissions.includes(permission) }) }));
vi.mock('@/lib/mutations/invalidation', () => ({ useInvalidate: () => mocks.invalidate }));
vi.mock('@/lib/useCurrentUrl', () => ({ useCurrentUrl: () => '/dashboard/course-management/course-one' }));
vi.mock('@/hooks/use-bulk-save-job', () => ({ useBulkSaveJob: () => ({}) }));
vi.mock('@/lib/api', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getCourseManagementSummary: mocks.summary, getCourseManagementAnalytics: mocks.analytics, getCourseManagementCurriculum: mocks.curriculum, getCourseManagementStudents: mocks.students, getCourseById: mocks.course, getCourseModules: mocks.modules, createModule: mocks.createModule, updateLesson: mocks.updateLesson, updateCourse: mocks.updateCourse }));
const course = { id: 'course-one', title: 'Number foundations', status: 'DRAFT', programme_type: 'UG', lesson_count: 1, access_type: 'FREE', locking_mode: 'OPEN', tags: [], description: 'Build number confidence.', created_at: '2026-09-01' };
const modules = [{ id: 'module-one', title: 'Fractions', order_index: 0, lessons: [{ id: 'lesson-one', title: 'Comparing fractions', youtube_url: 'https://youtube.com/watch?v=sample', duration_minutes: 8, notes_html: '', order_index: 0 }], module_quizzes: [] }, { id: 'module-two', title: 'Percentages', order_index: 1, lessons: [], module_quizzes: [] }];
beforeEach(() => {
  vi.clearAllMocks();
  permissions = ['courses.edit', 'courses.create', 'courses.manage_curriculum'];
  query = 'from=%2Fdashboard%2Fcourses';
  mocks.summary.mockResolvedValue({ course, metrics: { enrolled_students: 0, average_completion_percent: 0, average_quiz_score_percent: 0, assignment_submission_rate_percent: 0, at_risk_students: 0 }, module_progress: [], recent_activity: [] });
  mocks.analytics.mockResolvedValue({ enrollment_trend: [], progress_distribution: [], quiz_score_distribution: [] });
  mocks.curriculum.mockResolvedValue([]);
  mocks.students.mockResolvedValue({ items: [], total_pages: 1 });
  mocks.course.mockResolvedValue(course);
  mocks.modules.mockResolvedValue(modules);
  mocks.createModule.mockResolvedValue({ id: 'module-new', title: 'Revision', order_index: 2, lessons: [], module_quizzes: [] });
  mocks.updateLesson.mockResolvedValue({});
  mocks.updateCourse.mockResolvedValue({});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('course management workspace', () => {
  it('uses accessible tabs, preserves the return path, and avoids repeating curriculum summaries', async () => {
    render(<CourseManagementPage />);
    await screen.findByRole('heading', { name: 'Number foundations' });
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.queryByText('Curriculum Snapshot')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Students' }));
    expect(mocks.replace).toHaveBeenCalledWith('/dashboard/course-management/course-one?from=%2Fdashboard%2Fcourses&tab=students', { scroll: false });
  });
  it('keeps content-only editors out of roster and analytics tabs', async () => {
    query = 'tab=students';
    mocks.summary.mockRejectedValue(new ApiError('Not a manager', 403));
    render(<CourseManagementPage />);
    await screen.findByRole('heading', { name: 'Number foundations' });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Curriculum' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Students' })).toBeNull();
    expect(mocks.students).not.toHaveBeenCalled();
    expect(mocks.curriculum).not.toHaveBeenCalled();
  });
  it('shows access denial without hanging in loading or fetching course data', () => {
    permissions = [];
    render(<CourseManagementPage />);
    expect(screen.getByText('You don’t have permission to edit this course.')).toBeVisible();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('retains publishing and save-settings payloads', async () => {
    const view = render(<CourseManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish course' }));
    await waitFor(() => expect(mocks.updateCourse).toHaveBeenCalledWith('course-one', { status: 'ACTIVE', caller_id: 'manager', caller_role: 'PROGRAM_MANAGER' }));
    query = 'tab=settings';
    view.rerender(<CourseManagementPage />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Title' }), { target: { value: 'Updated foundations' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(mocks.updateCourse).toHaveBeenCalledWith('course-one', expect.objectContaining({ title: 'Updated foundations', caller_id: 'manager' })));
  });
});

describe('compact curriculum editor', () => {
  it('opens the first module and lets other modules expand independently', async () => {
    render(<CourseCurriculumEditor courseId="course-one" />);
    const first = await screen.findByRole('button', { name: /^Module.*Fractions/ });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    const second = screen.getByRole('button', { name: /^Module.*Percentages/ });
    expect(second).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(first);
    expect(screen.queryByRole('button', { name: /^Comparing fractions.*Lesson/ })).toBeNull();
  });
  it('edits a lesson through the row and preserves the save payload', async () => {
    render(<CourseCurriculumEditor courseId="course-one" />);
    fireEvent.click(await screen.findByRole('button', { name: /^Comparing fractions.*Lesson/ }));
    const drawer = screen.getByRole('dialog', { name: 'Edit lesson' });
    fireEvent.change(within(drawer).getByRole('textbox', { name: 'Title' }), { target: { value: 'Comparing unlike fractions' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.updateLesson).toHaveBeenCalledWith('lesson-one', expect.objectContaining({ title: 'Comparing unlike fractions', duration_minutes: 8 })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('creates a module inline and keeps quiz creation permission-gated', async () => {
    render(<CourseCurriculumEditor courseId="course-one" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add module' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New module title' }), { target: { value: 'Revision' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByRole('button', { name: /^Module.*Revision/ });
    expect(mocks.createModule).toHaveBeenCalledWith('course-one', 'Revision');
    expect(screen.queryByRole('link', { name: 'Add quiz' })).toBeNull();
  });
});
