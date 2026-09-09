import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { BulkParseJobStatus, ParsedBulkQuiz } from '@/lib/api';

const push = vi.fn();
let searchParams = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParams),
}));

const bulkParseQuiz = vi.fn();
const bulkSaveQuiz = vi.fn();
const getBulkParseJobStatus = vi.fn();
// The preview editor validates via the backend (debounced + at save) and
// fetches suggestion facets on mount — both must resolve deterministically
// here, not attempt real network calls from jsdom.
const bulkValidateQuiz = vi.fn().mockResolvedValue([]);
const getQuestionFacets = vi.fn().mockResolvedValue({ subjects: [], topics: [], tags: [] });
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  bulkParseQuiz: (...args: unknown[]) => bulkParseQuiz(...args),
  bulkSaveQuiz: (...args: unknown[]) => bulkSaveQuiz(...args),
  getBulkParseJobStatus: (...args: unknown[]) => getBulkParseJobStatus(...args),
  bulkValidateQuiz: (...args: unknown[]) => bulkValidateQuiz(...args),
  getQuestionFacets: (...args: unknown[]) => getQuestionFacets(...args),
}));

import BulkImportQuizPage from '@/app/dashboard/quiz-builder/bulk-import/page';

const QUIZ: ParsedBulkQuiz = {
  title: 'Physics 101',
  sections: [
    {
      title: 'Section A',
      questions: [
        { content: '2 + 2 = ?', question_type: 'MCQ', options: [{ text: '4', is_correct: true }] },
      ],
    },
  ],
};

function jobStatus(status: string): BulkParseJobStatus {
  return { jobId: 'job-1', status, progress: 50 };
}

const COMPLETED: BulkParseJobStatus = {
  ...jobStatus('completed'),
  result: { quiz_id: 'quiz-9', sections: 1, questions: 1 },
};

/** Drives the page to the preview step, then clicks Confirm & Save. */
async function parseThenSave() {
  render(<BulkImportQuizPage />);

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['q1'], 'quiz.csv', { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Parse File/ }));
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Save Quiz/ }));
  });
}

/** Lets the page's polling loop run one iteration. */
async function tickPoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  searchParams = '';
  push.mockClear();
  bulkParseQuiz.mockResolvedValue(QUIZ);
  bulkSaveQuiz.mockResolvedValue({ jobId: 'job-1' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('bulk import save', () => {
  it('waits for the save job to complete, then returns to the list it came from', async () => {
    getBulkParseJobStatus
      .mockResolvedValueOnce(jobStatus('active'))
      .mockResolvedValueOnce(jobStatus('active'))
      .mockResolvedValue(COMPLETED);

    await parseThenSave();

    // A fixed 2.5s delay would have redirected by now; the job has not finished.
    await tickPoll();
    await tickPoll();
    expect(push).not.toHaveBeenCalled();

    await tickPoll();
    expect(push).toHaveBeenCalledWith('/dashboard/test-bank?uploadJobId=job-1');
  });

  it('returns to the page named by ?from= when there is one', async () => {
    searchParams = 'from=%2Fdashboard%2Fcourse-management%2Fc1%3Ftab%3Dcurriculum';
    getBulkParseJobStatus.mockResolvedValue(COMPLETED);

    await parseThenSave();
    await tickPoll();

    expect(push).toHaveBeenCalledWith('/dashboard/course-management/c1?tab=curriculum');
  });

  it('ignores an off-site ?from= and falls back to the test bank', async () => {
    searchParams = 'from=https%3A%2F%2Fevil.example.com';
    getBulkParseJobStatus.mockResolvedValue(COMPLETED);

    await parseThenSave();
    await tickPoll();

    expect(push).toHaveBeenCalledWith('/dashboard/test-bank?uploadJobId=job-1');
  });

  it('shows the error and stays put when the save job fails', async () => {
    getBulkParseJobStatus.mockResolvedValue({ ...jobStatus('failed'), error: 'Save exploded' });

    await parseThenSave();
    await tickPoll();

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText('Save exploded')).toBeTruthy();
  });
});
