import { describe, expect, it, vi, afterEach } from 'vitest';
import * as nav from '../lib/nav';
import { duplicateCourse, duplicateQuiz } from '../lib/api';
import { DOMAIN_KEYS } from '../lib/mutations/invalidation';

afterEach(() => vi.unstubAllGlobals());
describe('URL-backed programme context', () => {
  it('restores student search, school, reach and page from the return URL', () => {
    expect(nav.readProgrammeState?.(new URLSearchParams('tab=students&q=Priya&school=s1&via=BATCH&page=2')))
      .toEqual({ tab: 'students', q: 'Priya', school: 's1', via: 'BATCH', page: 2 });
  });
  it('normalizes invalid tabs and offsets', () => {
    expect(nav.readProgrammeState?.(new URLSearchParams('tab=unknown&page=-1&via=no')))
      .toMatchObject({ tab: 'overview', page: 0, via: '' });
  });
  it('changes the tab without discarding the roster filters or outer back target', () => {
    const result = nav.updateProgrammeUrl?.('/dashboard/programmes/p1', new URLSearchParams('tab=students&q=Priya&page=2&from=%2Fdashboard%2Fprogrammes'), { tab: 'people' });
    expect(result).toBe('/dashboard/programmes/p1?tab=people&q=Priya&page=2&from=%2Fdashboard%2Fprogrammes');
  });
});
describe('copy destination transport', () => {
  it('sends the selected programme to course duplication', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'copy' })));
    vi.stubGlobal('fetch', fetch);
    await duplicateCourse('source', 'p2');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ programme_id: 'p2' });
  });
  it('distinguishes omitted auto-selection from explicit global for quizzes', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ id: 'copy' }))));
    vi.stubGlobal('fetch', fetch);
    await duplicateQuiz('source');
    await duplicateQuiz('source', null);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({});
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ programme_id: null });
  });
});
describe('programme changes refresh dependent access and data', () => {
  it('covers protected data, curriculum, destination pickers and identity', () => {
    const prefixes = DOMAIN_KEYS.programmes?.map((key) => key[1]);
    expect(prefixes).toEqual(expect.arrayContaining(['programmes', 'programme', 'courses', 'course', 'quizzes', 'quiz', 'student', 'analytics', 'user', 'batches', 'schools', 'duplicate']));
  });
});
