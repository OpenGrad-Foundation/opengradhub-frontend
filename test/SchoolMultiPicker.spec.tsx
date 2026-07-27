import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SchoolOption } from '@/lib/api';
import { SchoolMultiPicker } from '@/components/SchoolMultiPicker';

function school(over: Partial<SchoolOption> & { id: string; name: string }): SchoolOption {
  return {
    state: null,
    district: null,
    code: null,
    fellow_id: null,
    fellow_name: null,
    ...over,
  };
}

const SCHOOLS: SchoolOption[] = [
  school({ id: 's1', name: 'Green Valley High', code: 'GVH-01', district: 'Coimbatore', state: 'Tamil Nadu' }),
  school({ id: 's2', name: 'Riverside Public', code: 'RPS-02', district: 'Madurai', state: 'Tamil Nadu' }),
  school({ id: 's3', name: 'Hilltop Academy', code: 'HTA-03', district: 'Kochi', state: 'Kerala' }),
];

function labelsShown(): string[] {
  return screen
    .getAllByRole('checkbox')
    .map((cb) => (cb.closest('label') as HTMLElement).textContent ?? '');
}

describe('SchoolMultiPicker', () => {
  let onChange: ReturnType<typeof vi.fn<(ids: string[]) => void>>;

  beforeEach(() => {
    onChange = vi.fn<(ids: string[]) => void>();
  });

  function setup(value: string[] = [], disabledIds?: string[]) {
    return render(
      <SchoolMultiPicker
        schools={SCHOOLS}
        value={value}
        onChange={onChange}
        disabledIds={disabledIds}
      />,
    );
  }

  it('lists every school when the query is empty', () => {
    setup();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('filters by school name', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hilltop' } });
    expect(labelsShown().join('|')).toContain('Hilltop Academy');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('filters by school code', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rps-02' } });
    expect(labelsShown().join('|')).toContain('Riverside Public');
  });

  it('filters by district', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'madurai' } });
    expect(labelsShown().join('|')).toContain('Riverside Public');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('filters by state', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'kerala' } });
    expect(labelsShown().join('|')).toContain('Hilltop Academy');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('adds a school id when an unselected school is toggled', () => {
    setup(['s1']);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    expect(onChange).toHaveBeenCalledWith(['s1', 's3']);
  });

  it('removes a school id when a selected school is toggled', () => {
    setup(['s1', 's3']);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalledWith(['s3']);
  });

  it('renders a removable chip per selected school', () => {
    setup(['s2']);
    const chip = screen.getByRole('button', { name: 'Remove Riverside Public' });
    fireEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('keeps a selected chip visible even when that school is disabled', () => {
    setup(['s2'], ['s2']);
    expect(screen.getByRole('button', { name: 'Remove Riverside Public' })).toBeTruthy();
  });

  it('does not allow toggling a disabled school', () => {
    setup([], ['s1']);
    const first = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(first.disabled).toBe(true);
    fireEvent.click(first);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports when nothing matches the query', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('No matching schools.')).toBeTruthy();
  });
});
