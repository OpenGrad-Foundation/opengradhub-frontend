import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ preview: vi.fn(), commit: vi.fn() }));
vi.mock('@/lib/student-details-import-api', () => ({ previewStudentImport: api.preview, commitStudentImport: api.commit }));
vi.mock('@/lib/queries/tracker', () => ({
  useStudentFields: () => ({ data: { fields: [{ id: 'f1', field_key: 'phone', label: 'Parent phone', field_type: 'text', status: 'active' }] }, isLoading: false, error: null }),
}));
import { StudentDetailsBulkUpload } from '@/app/dashboard/tracker/_components/student-details-bulk-upload';

const previewRows = [
  { row_number: 2, identifier: '001', status: 'ready', student_id: 's1', student_name: 'Student One', school_name: 'School A', messages: [], changes: [{ field_key: 'phone', label: 'Parent phone', previous: null, value: '0091' }] },
  { row_number: 3, identifier: '002', status: 'ready', student_id: 's2', student_name: 'Student Two', school_name: 'School B', messages: [], changes: [{ field_key: 'phone', label: 'Parent phone', previous: null, value: '0092' }] },
  { row_number: 4, identifier: '003', status: 'unmatched', messages: ['No matching student in your permitted scope.'], changes: [] },
];
beforeEach(() => {
  api.preview.mockReset().mockResolvedValue({ rows: previewRows });
  api.commit.mockReset().mockResolvedValue({ saved: 1, saved_cells: 1, rows: [{ ...previewRows[0], status: 'saved' }] });
});
afterEach(cleanup);
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StudentDetailsBulkUpload onClose={() => {}} /></QueryClientProvider>);
}
async function review(wait = true) {
  mount();
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [new File(['Roll,Phone\n001,0091\n002,0092\n003,0093'], 'students.csv', { type: 'text/csv' })] } });
  await screen.findByText(/3 rows/);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByLabelText('Map Phone'), { target: { value: 'phone' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByLabelText('Identifier column'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Match against'), { target: { value: 'roll_number' } });
  fireEvent.click(screen.getByRole('button', { name: 'Match students' }));
  if (wait) await screen.findByText('Student One');
}
describe('student bulk upload modal', () => {
  it('locks identifier and overwrite choices while matches are loading', async () => {
    api.preview.mockReturnValue(new Promise(() => {}));
    await review(false);
    expect((screen.getByLabelText('Identifier column') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Match against') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Overwrite existing/ }) as HTMLInputElement).disabled).toBe(true);
  });
  it('reviews scoped matches, selects eligible students across filters, and commits only the chosen match', async () => {
    await review();
    expect(screen.queryByLabelText('Select 003')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Select all eligible' }));
    fireEvent.change(screen.getByLabelText('Filter by school'), { target: { value: 'School A' } });
    expect(screen.queryByText('Student Two')).toBeNull();
    expect(screen.getByRole('button', { name: 'Update 2 students' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter by school'), { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Select Student Two'));
    fireEvent.click(screen.getByRole('button', { name: 'Update 1 student' }));
    await screen.findByText(/1 student updated/);
    expect(api.commit).toHaveBeenCalledWith(expect.objectContaining({ overwrite: false, selected: [{ row_number: 2, student_id: 's1' }] }));
  });
  it('invalidates review when going back to change the matching configuration', async () => {
    await review();
    fireEvent.click(screen.getByRole('button', { name: 'Select all eligible' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('button', { name: /Update .* student/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Match students' }));
    await waitFor(() => expect(api.preview).toHaveBeenCalledTimes(2));
    expect((screen.getByRole('button', { name: 'Update 0 students' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('reports a failed save without claiming success', async () => {
    api.commit.mockRejectedValue(new Error('Connection interrupted.'));
    await review();
    fireEvent.click(screen.getByLabelText('Select Student One'));
    fireEvent.click(screen.getByRole('button', { name: 'Update 1 student' }));
    await screen.findByRole('alert');
    expect(screen.queryByText(/1 student updated/)).toBeNull();
  });
});
