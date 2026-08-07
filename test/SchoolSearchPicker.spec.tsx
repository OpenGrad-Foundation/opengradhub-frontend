import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SchoolOption } from '@/lib/api';
import { SchoolSearchPicker } from '@/components/SchoolSearchPicker';

function school(over: Partial<SchoolOption> & { id: string; name: string }): SchoolOption {
  return { state: null, district: null, code: null, fellow_id: null, fellow_name: null, ...over };
}

const SCHOOLS: SchoolOption[] = [
  school({ id: 's1', name: 'Green Valley High', code: 'GVH-01', district: 'Coimbatore', state: 'Tamil Nadu' }),
  school({ id: 's2', name: 'Hilltop Academy', code: 'HTA-03', district: 'Kochi', state: 'Kerala' }),
];

describe('SchoolSearchPicker', () => {
  let onChange: ReturnType<typeof vi.fn<(id: string) => void>>;

  beforeEach(() => {
    onChange = vi.fn<(id: string) => void>();
  });

  function setup() {
    const utils = render(<SchoolSearchPicker schools={SCHOOLS} value="" onChange={onChange} />);
    fireEvent.focus(utils.container.querySelector('input') as HTMLInputElement);
    return utils;
  }

  function search(container: HTMLElement, text: string) {
    fireEvent.change(container.querySelector('input') as HTMLInputElement, { target: { value: text } });
  }

  it('matches on district, which the dropdown row displays', () => {
    const { container } = setup();
    search(container, 'kochi');
    expect(screen.getByText('Hilltop Academy')).toBeTruthy();
    expect(screen.queryByText('Green Valley High')).toBeNull();
  });

  it('matches on state, which the dropdown row displays', () => {
    const { container } = setup();
    search(container, 'tamil nadu');
    expect(screen.getByText('Green Valley High')).toBeTruthy();
    expect(screen.queryByText('Hilltop Academy')).toBeNull();
  });

  it('still matches on name and code', () => {
    const { container } = setup();
    search(container, 'hta-03');
    expect(screen.getByText('Hilltop Academy')).toBeTruthy();
  });
});
