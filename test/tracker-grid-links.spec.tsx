import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TrackerGrid, TrackerGridRow, TrackerTemplate } from '@/lib/tracker-api';
const idle = { mutateAsync: vi.fn(), isPending: false };
const empty = { data: undefined, isLoading: false, error: null };

vi.mock("@/lib/queries/tracker", () => ({
  useTemplateGeoVerifications: () => empty,
  useUploadGeoVerification: () => idle,
  useOverrideGeoVerification: () => idle,
  useSaveTrackerBatch: () => idle,
  useSaveTrackerBatchOnBehalf: () => idle,
  useRaiseTrackerBlocker: () => idle,
  useClearTrackerBlocker: () => idle,
  useRecordGeoVerification: () => empty,
  useTrackerRecordHistory: () => empty,
  useRecordPeriodHistory: () => empty,
  useRecordExtensions: () => empty,
  useGrantExtension: () => idle,
  useTrackerProofs: () => empty,
  useUploadProofPhoto: () => idle,
  useDeleteProofPhoto: () => idle,
  useCaptureProofLocation: () => idle,
  useStudentDetails: () => empty,
  useSaveStudentDetails: () => idle,
}));

import { TrackerEditableGrid } from "@/app/dashboard/tracker/_components/tracker-grid";

const template: TrackerTemplate = ({
  id: "t1", code: "VISIT", name: "School visit", description: null,
  target_type: "student", completion_style: "checklist", workflow_statuses: null,
  done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
  require_photo: false, require_location: false, require_geo_verification: false,
  status: "active",
}) as TrackerTemplate;


afterEach(cleanup);
function mount(value: unknown, editable = false, type: 'url' | 'text' = 'url') {
  const row = { record_id: 'r1', target_name: 'Student', status: 'not_started', lifecycle: 'not_started',
    cells: [{ field_key: 'drive', value }], blocked: false, blocker: null, can_fill_self: editable,
    can_fill_override: false, can_evidence: false, can_blocker: false } as TrackerGridRow;
  const grid: TrackerGrid = { columns: [{ field_key: 'drive', label: 'Drive link', field_type: type, source: 'input', options: null, source_path: null, required: false, visible_if: null, sort_order: 0 }], rows: [row] };
  return render(<TrackerEditableGrid template={template} grid={grid} canFill={editable} canClear={false} />);
}
describe('task grid links', () => {
  it.each(['url', 'text'] as const)('makes saved web addresses clickable in %s fields', type => {
    mount('https://drive.google.com/file/d/example', false, type);
    const links = screen.getAllByRole('link', { name: 'https://drive.google.com/file/d/example' });
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('https://drive.google.com/file/d/example');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
  it('offers a link immediately after typing and keeps the field editable', () => {
    mount('', true);
    // Skip the toolbar's "Fill all" value box — the first cell input is the one under test.
    const input = screen.getAllByRole('textbox').filter((el) => el.getAttribute('aria-label') !== 'Value')[0];
    fireEvent.change(input, { target: { value: 'https://example.com/first' } });
    expect(screen.getAllByRole('link', { name: 'Open Drive link' })[0].getAttribute('href')).toBe('https://example.com/first');
    fireEvent.change(input, { target: { value: 'https://example.com/second' } });
    expect(screen.getAllByRole('link', { name: 'Open Drive link' })[0].getAttribute('href')).toBe('https://example.com/second');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByRole('link', { name: 'Open Drive link' })).toBeNull();
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', 'not a link', null])('does not create a web link for %s', value => {
    mount(value); expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
