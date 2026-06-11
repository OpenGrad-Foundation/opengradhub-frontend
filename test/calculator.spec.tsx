import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Calculator } from '@/components/calculator';

describe('Calculator component', () => {
  it('renders display starting at 0', () => {
    render(<Calculator />);
    expect(screen.getByTestId('calc-display').textContent).toBe('0');
  });

  it('computes 2 + 3 = 5 via button clicks', () => {
    render(<Calculator />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '=' }));
    expect(screen.getByTestId('calc-display').textContent).toBe('5');
  });

  it('handles keyboard input', () => {
    render(<Calculator />);
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: '*' });
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('calc-display').textContent).toBe('42');
  });
});
