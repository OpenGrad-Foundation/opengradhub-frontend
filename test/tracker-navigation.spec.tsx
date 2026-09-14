import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const state = vi.hoisted(() => ({ params: new URLSearchParams('tab=allTasks'), push: vi.fn(), grid: vi.fn(), author: true }));
vi.mock('next/navigation', () => ({ useSearchParams: () => state.params, usePathname: () => '/dashboard/tracker', useRouter: () => ({ push: state.push, replace: vi.fn() }) }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'me' }, role: { code: 'ZONAL_MANAGER', name: 'Zonal Manager' } }, isLoading: false }) }));
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({ has: (p: string) => state.author || ['tracker.view', 'tracker.fill'].includes(p), isLoading: false }) }));
vi.mock('@/lib/queries/tracker', () => ({
  useTrackerFellows: () => ({ data: [{ id: 'f1', name: 'Fellow One' }] }),
  useTrackerFellowTasks: () => ({ data: [] }),
  useTrackerTemplates: () => ({ data: [{ id: 't1', name: 'Task One' }, { id: 't2', name: 'Task Two' }] }),
  useTrackerTemplate: (id: string) => ({ data: { template: { id, name: id } } }),
  useTrackerGrid: (id: string, owner: string) => { state.grid(id, owner); return { data: { rows: [{ record_id: 'r1', lifecycle: 'not_started', cells: [] }], columns: [] } }; },
  useTrackerMineBlockers: () => ({ data: [] }), useTrackerQueueBlockers: () => ({ data: [] }),
  useTrackerOverview: () => ({ data: { counts: { done: 0, pending: 1, blocked: 0, overdue: 0 }, perTask: [] } }),
  useAddBlockerComment: vi.fn(), useBlockerThread: vi.fn(), useClearTrackerBlocker: vi.fn(),
}));
vi.mock('@/app/dashboard/tracker/_components/nudge-button', () => ({ NudgeButton: () => null }));
vi.mock('@/components/PushNudge', () => ({ default: () => null }));
vi.mock('@/app/dashboard/tracker/_components/all-tasks', () => ({ AllTasksPanel: ({ onOpenTask, onOpenDrill }: any) => <div>All task list<button onClick={() => onOpenTask('t1')}>Open first task</button><button onClick={() => onOpenDrill({ template_id: 't1', name: 'Task One', target_type: 'student', done: 0, total: 1 })}>Open breakdown</button></div> }));
vi.mock('@/app/dashboard/tracker/_components/task-breakdown', () => ({ TaskBreakdown: ({ onBack, onOpenTask }: any) => <div>Task breakdown<button onClick={onBack}>Back to tasks</button><button onClick={() => onOpenTask('t1')}>Open task data</button></div> }));
vi.mock('@/app/dashboard/tracker/_components/team-view', () => ({ AssignTaskButton: () => null, TeamView: ({ onOpen, onAssign, initialOwnerId }: any) => <div>Team list {initialOwnerId}<button onClick={() => onOpen('t2', 'f1', 'Fellow One')}>Open fellow task</button><button onClick={() => onAssign({ id: 'f1', name: 'Fellow One' })}>Assign task</button></div> }));
vi.mock('@/app/dashboard/tracker/_components/my-tasks', () => ({ TaskListView: () => <div>Fellow task list</div>, MyTasksList: ({ onOpen }: any) => <div>My task list<button onClick={() => onOpen('t1')}>Open own task</button></div> }));
vi.mock('@/app/dashboard/tracker/_components/tracker-grid', () => ({ TrackerEditableGrid: ({ template, owner }: any) => <div>Grid: {template.name} {owner?.name}</div> }));
vi.mock('@/app/dashboard/tracker/_components/tracker-builder', () => ({ TrackerBuilder: ({ onCreated, prefill }: any) => <div>Task builder {prefill?.label}<button onClick={() => onCreated('new-task')}>Create task</button></div> }));
vi.mock('@/app/dashboard/tracker/_components/task-detail', () => ({ TaskDetail: ({ template }: any) => <div>Manage: {template.id}</div> }));
vi.mock('@/app/dashboard/tracker/_components/student-fields-manager', () => ({ StudentFieldsManager: () => <p>Field setup</p> }));
vi.mock('@/app/dashboard/tracker/_components/hierarchical-students', () => ({ HierarchicalStudentsPanel: () => <p>Student list</p> }));
vi.mock('@/app/dashboard/tracker/_components/filter-bar', () => ({ FilterBar: () => null }));
import TrackerPage from '@/app/dashboard/tracker/page';
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const tab = (name: string) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }));
beforeEach(() => { state.params = new URLSearchParams('tab=allTasks'); state.author = true; state.grid.mockClear(); state.push.mockReset().mockImplementation((url: string) => { state.params = new URLSearchParams(url.split('?')[1]); }); });
afterEach(cleanup);

describe('tracker navigation', () => {
  it('returns to the list when the active All Tasks tab is clicked', () => {
    render(<TrackerPage />); click('Open first task'); expect(screen.getByText('Grid: Task One')).toBeTruthy();
    tab('All Tasks'); expect(screen.getByText('All task list')).toBeTruthy(); expect(screen.queryByText('Grid: Task One')).toBeNull();
  });
  it('clears a task when switching between Tasks and All Tasks', () => {
    render(<TrackerPage />); tab('Tasks'); click('Open fellow task');
    expect(state.grid).toHaveBeenLastCalledWith('t2', 'f1');
    tab('All Tasks'); expect(screen.getByText('All task list')).toBeTruthy();
    click('Open first task'); expect(state.grid).toHaveBeenLastCalledWith('t1', undefined);
    tab('Tasks'); expect(screen.getByText('Team list')).toBeTruthy();
  });
  it('keeps in-task Back one level up, but the tab returns to the list', () => {
    render(<TrackerPage />); click('Open breakdown'); click('Open task data'); click('Back to Task One');
    expect(screen.getByText('Task breakdown')).toBeTruthy(); tab('All Tasks'); expect(screen.getByText('All task list')).toBeTruthy();
  });
  it.each(['Blockers', 'Team & Students', 'Fields Setup'])('does not resurrect the old task after visiting %s', name => {
    render(<TrackerPage />); click('Open first task'); tab(name); tab('All Tasks'); expect(screen.getByText('All task list')).toBeTruthy();
  });
  it('opens a newly created task instead of the previous task grid', () => {
    render(<TrackerPage />); click('Open first task'); tab('New task'); click('Create task'); expect(screen.getByText('Manage: new-task')).toBeTruthy();
  });
  it('responds to a new deep link and browser navigation without remounting', () => {
    state.params = new URLSearchParams('task=t1&owner=f1'); const view = render(<TrackerPage />);
    state.params = new URLSearchParams('task=t2&owner=f2'); view.rerender(<TrackerPage />);
    expect(screen.getByText(/Grid: Task Two/)).toBeTruthy(); expect(state.grid).toHaveBeenLastCalledWith('t2', 'f2');
    state.params = new URLSearchParams('tab=allTasks'); view.rerender(<TrackerPage />); expect(screen.getByText('All task list')).toBeTruthy();
  });
  it('clears stale task and origin URL params on tab navigation', () => {
    state.params = new URLSearchParams('task=t1&owner=f1&from=%2Fdashboard%2Fstudents%2Fs1'); render(<TrackerPage />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/dashboard/students/s1');
    tab('All Tasks'); expect(state.params.get('tab')).toBe('allTasks'); expect(state.params.has('task')).toBe(false); expect(state.params.has('owner')).toBe(false); expect(state.params.has('from')).toBe(false);
  });
  it('records task navigation and restores the grid after browser Back/Forward', () => {
    const view = render(<TrackerPage />); click('Open first task');
    const taskUrl = state.params.toString(); expect(state.params.get('task')).toBe('t1');
    tab('All Tasks'); const listUrl = state.params.toString();
    state.params = new URLSearchParams(taskUrl); view.rerender(<TrackerPage />); expect(screen.getByText('Grid: Task One')).toBeTruthy();
    state.params = new URLSearchParams(listUrl); view.rerender(<TrackerPage />); expect(screen.getByText('All task list')).toBeTruthy();
  });
  it('returns to the same team member and clears that owner on a top-level tab click', () => {
    render(<TrackerPage />); tab('Tasks'); click('Open fellow task'); click('Back to team tasks');
    // By team reopens that person's list from the owner kept in the URL.
    expect(screen.getByText('Team list f1')).toBeTruthy(); expect(state.params.has('task')).toBe(false);
    tab('Tasks'); expect(screen.getByText('Team list')).toBeTruthy(); expect(state.params.has('owner')).toBe(false);
  });
  it('does not reset an open task or owner when only filters change', () => {
    const view = render(<TrackerPage />); tab('Tasks'); click('Open fellow task');
    state.params = new URLSearchParams(state.params); state.params.set('q', 'student'); view.rerender(<TrackerPage />);
    expect(screen.getByText('Grid: Task Two Fellow One')).toBeTruthy(); expect(state.grid).toHaveBeenLastCalledWith('t2', 'f1');
  });
  it('resets a Fellow task via the Tasks tab without exposing manager tabs', () => {
    state.author = false; state.params = new URLSearchParams('tab=myTasks'); render(<TrackerPage />);
    expect(screen.queryByRole('button', { name: 'All Tasks' })).toBeNull();
    click('Open own task'); tab('Tasks'); expect(screen.getByText('My task list')).toBeTruthy();
  });
  it('clears assignment prefill when New task is reselected', () => {
    render(<TrackerPage />); tab('Tasks'); click('Assign task'); expect(screen.getByText('Task builder Fellow One')).toBeTruthy();
    tab('New task'); expect(screen.getByText('Task builder')).toBeTruthy();
  });
  it('restores a task breakdown from history and a fresh URL', () => {
    const view = render(<TrackerPage />); click('Open breakdown'); const breakdownUrl = state.params.toString();
    expect(state.params.get('drill')).toBe('t1'); click('Open task data');
    state.params = new URLSearchParams(breakdownUrl); view.rerender(<TrackerPage />); expect(screen.getByText('Task breakdown')).toBeTruthy();
    view.unmount(); const fresh = render(<TrackerPage />); expect(screen.getByText('Task breakdown')).toBeTruthy();
    click('Back to tasks'); fresh.rerender(<TrackerPage />); expect(screen.getByText('All task list')).toBeTruthy(); expect(state.params.has('drill')).toBe(false);
  });
});
