import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssessmentsPage from '@/app/dashboard/assessments/page';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), overview: vi.fn(), refetch: vi.fn(), leaderboard: vi.fn() }));
let permissions: string[];
let params: URLSearchParams;
let result: { items: object[]; total: number; page: number; size: number };
let error: Error | null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => params, usePathname: () => '/dashboard/assessments' }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: {user:{id:'manager'},permissions}, isLoading:false }) }));
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({ has: (p:string) => permissions.includes(p) }) }));
vi.mock('@/lib/useCurrentUrl', () => ({ useCurrentUrl: () => '/dashboard/assessments' }));
vi.mock('@/lib/queries/assessments', () => ({ useAssessmentsOverview: (args:unknown) => { mocks.overview(args); return {data:result,isPending:false,isError:!!error,error,refetch:mocks.refetch}; } }));
vi.mock('@/lib/queries/batches', () => ({ useBatches: () => ({data:[{id:'b1',name:'Foundation batch'}]}) }));
vi.mock('@/lib/queries/programmes', () => ({ useProgrammes: () => ({data:[{id:'p1',name:'Foundation',is_member:false}]}) }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), getQuizLeaderboard:mocks.leaderboard }));
beforeEach(() => {
  vi.clearAllMocks(); params = new URLSearchParams(); error = null;
  permissions = ['scope.unrestricted','students.view','analytics.view','assessments.view','programmes.view','batches.view','test_bank.view','test_bank.create'];
  result = {items:[{quiz_id:'q1',title:'Fractions checkpoint',type:'MODULE',programme_name:'Foundation',course_title:'Maths',students_attempted:23,attempts_count:31,avg_score_pct:0,pass_rate_pct:null,last_attempted_at:null}],total:21,page:1,size:20};
  mocks.leaderboard.mockResolvedValue({rankings:[]});
  HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open','');};
  HTMLDialogElement.prototype.close = function() {this.removeAttribute('open');};
});
afterEach(cleanup);
describe('Staff quizzes', () => {
  it('keeps programme reach and hides the programme type tab for scoped staff', () => {
    permissions = permissions.filter(p => p !== 'scope.unrestricted');
    render(<AssessmentsPage />);
    expect(screen.queryByRole('tab',{name:'Programme quizzes'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Filters'}));
    expect(screen.getByRole('option',{name:'Foundation'})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Programme'),{target:{value:'p1'}});
    expect(mocks.replace).toHaveBeenLastCalledWith('/dashboard/assessments?programme_id=p1',{scroll:false});
  });
  it('shows the owning programme, zero scores, and opens results without resetting filters', () => {
    params = new URLSearchParams('programme_id=p1&page=2');
    render(<AssessmentsPage />);
    const row = screen.getByRole('button',{name:/Fractions checkpoint/});
    expect(row.textContent).toContain('Foundation · Maths');
    expect(row.textContent).toContain('0%');
    expect(row.textContent).toContain('31 attempts');
    fireEvent.click(row);
    expect(mocks.replace).toHaveBeenLastCalledWith('/dashboard/assessments?programme_id=p1&page=2&drawer=q1',{scroll:false});
  });
  it('resets pagination when searching or changing quiz type and keeps other parameters', () => {
    params = new URLSearchParams('programme_id=p1&page=2');
    render(<AssessmentsPage />);
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'algebra'}});
    expect(mocks.replace).toHaveBeenLastCalledWith('/dashboard/assessments?programme_id=p1&q=algebra',{scroll:false});
    fireEvent.click(screen.getByRole('tab',{name:'Module quizzes'}));
    expect(mocks.replace).toHaveBeenLastCalledWith('/dashboard/assessments?programme_id=p1&type=MODULE',{scroll:false});
    fireEvent.click(screen.getByRole('button',{name:'Next page'}));
    expect(mocks.replace).toHaveBeenLastCalledWith('/dashboard/assessments?programme_id=p1&page=2',{scroll:false});
  });
  it('points an empty scoped list to programme content and distinguishes errors', () => {
    permissions = permissions.filter(p => p !== 'scope.unrestricted'); result.items=[]; result.total=0;
    const view = render(<AssessmentsPage />);
    expect(screen.getByRole('link',{name:/Open programme content/}).getAttribute('href')).toBe('/dashboard/programmes/p1?tab=content');
    error = new Error('Offline'); view.rerender(<AssessmentsPage />);
    expect(screen.queryByText('No quizzes to monitor yet')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Try again'})); expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it('opens a modal result drawer and restores page scrolling on close', async () => {
    params = new URLSearchParams('drawer=q1');
    const view = render(<AssessmentsPage />);
    expect(screen.getByRole('dialog',{name:'Quiz Details'})).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    expect(await screen.findByText('No completed attempts yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Close quiz details'}));
    expect(mocks.replace).toHaveBeenLastCalledWith('/dashboard/assessments?',{scroll:false});
    view.unmount(); await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });
});
