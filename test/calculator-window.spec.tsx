import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalculatorWindow } from '@/components/calculator-window';

describe('CalculatorWindow', () => {
  it('renders the calculator keypad and display', () => {
    render(<CalculatorWindow onClose={() => {}} />);
    expect(screen.getByTestId('calc-display').textContent).toBe('0');
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<CalculatorWindow onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close calculator' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still computes via clicks while floating', () => {
    render(<CalculatorWindow onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '=' }));
    expect(screen.getByTestId('calc-display').textContent).toBe('64');
  });
});
