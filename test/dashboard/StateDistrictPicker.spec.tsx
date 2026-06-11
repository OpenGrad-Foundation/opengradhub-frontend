import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StateDistrictPicker } from '@/app/dashboard/_components/StateDistrictPicker';

afterEach(cleanup);

describe('StateDistrictPicker', () => {
  it('renders state options including All by default', () => {
    render(<StateDistrictPicker state="" district="" onStateChange={() => {}} onDistrictChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'Kerala' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'All' })).toBeTruthy();
  });

  it('omits the All option when includeAll is false', () => {
    render(<StateDistrictPicker state="" district="" includeAll={false} onStateChange={() => {}} onDistrictChange={() => {}} />);
    expect(screen.queryByRole('option', { name: 'All' })).toBeNull();
  });

  it('district select is disabled when no state chosen', () => {
    render(<StateDistrictPicker state="" district="" onStateChange={() => {}} onDistrictChange={() => {}} />);
    expect((screen.getByLabelText('District') as HTMLSelectElement).disabled).toBe(true);
  });

  it('district select is disabled when state is ALL', () => {
    render(<StateDistrictPicker state="ALL" district="" onStateChange={() => {}} onDistrictChange={() => {}} />);
    expect((screen.getByLabelText('District') as HTMLSelectElement).disabled).toBe(true);
  });

  it('shows districts for the chosen state', () => {
    render(<StateDistrictPicker state="KERALA" district="" onStateChange={() => {}} onDistrictChange={() => {}} />);
    expect((screen.getByLabelText('District') as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole('option', { name: 'Ernakulam' })).toBeTruthy();
  });

  it('changing state fires onStateChange and resets district to empty', () => {
    const onState = vi.fn();
    const onDistrict = vi.fn();
    render(<StateDistrictPicker state="KERALA" district="Ernakulam" onStateChange={onState} onDistrictChange={onDistrict} />);
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'KARNATAKA' } });
    expect(onState).toHaveBeenCalledWith('KARNATAKA');
    expect(onDistrict).toHaveBeenCalledWith('');
  });

  it('changing district fires onDistrictChange', () => {
    const onDistrict = vi.fn();
    render(<StateDistrictPicker state="KERALA" district="" onStateChange={() => {}} onDistrictChange={onDistrict} />);
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Ernakulam' } });
    expect(onDistrict).toHaveBeenCalledWith('Ernakulam');
  });
});
