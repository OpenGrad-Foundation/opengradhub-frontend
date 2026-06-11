import { describe, it, expect } from 'vitest';
import { initialCalcState, applyKey, formatNumber, type CalcKey } from '@/lib/calculator-engine';

/** Feed a sequence of keys from the initial state and return the final display. */
function run(keys: CalcKey[]): string {
  return keys.reduce((s, k) => applyKey(s, k), initialCalcState).display;
}

describe('formatNumber', () => {
  it('trims floating-point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });
  it('keeps integers clean', () => {
    expect(formatNumber(5)).toBe('5');
  });
  it('returns Error for non-finite', () => {
    expect(formatNumber(Infinity)).toBe('Error');
    expect(formatNumber(NaN)).toBe('Error');
  });
});

describe('digit and decimal entry', () => {
  it('starts at 0', () => {
    expect(initialCalcState.display).toBe('0');
  });
  it('first digit replaces the leading zero', () => {
    expect(run(['7'])).toBe('7');
  });
  it('appends subsequent digits', () => {
    expect(run(['1', '2', '3'])).toBe('123');
  });
  it('does not stack leading zeros', () => {
    expect(run(['0', '0', '5'])).toBe('5');
  });
  it('adds a single decimal point', () => {
    expect(run(['1', '.', '5'])).toBe('1.5');
  });
  it('ignores a second decimal point', () => {
    expect(run(['1', '.', '5', '.', '2'])).toBe('1.52');
  });
  it('decimal on fresh entry yields 0.', () => {
    expect(run(['.'])).toBe('0.');
  });
});

describe('binary operators and equals', () => {
  it('adds two numbers', () => {
    expect(run(['2', '+', '3', '='])).toBe('5');
  });
  it('subtracts', () => {
    expect(run(['9', '−', '4', '='])).toBe('5');
  });
  it('multiplies', () => {
    expect(run(['6', '×', '7', '='])).toBe('42');
  });
  it('divides', () => {
    expect(run(['8', '÷', '2', '='])).toBe('4');
  });
  it('chains left-to-right (no precedence)', () => {
    expect(run(['2', '+', '3', '×', '4', '='])).toBe('20');
  });
  it('reuses the result as the next left operand', () => {
    expect(run(['2', '+', '3', '=', '×', '2', '='])).toBe('10');
  });
  it('changing operator before entering operand keeps the accumulator', () => {
    expect(run(['5', '+', '×', '2', '='])).toBe('10');
  });
  it('division by zero yields Error', () => {
    expect(run(['5', '÷', '0', '='])).toBe('Error');
  });
  it('keeps decimals accurate', () => {
    expect(run(['0', '.', '1', '+', '0', '.', '2', '='])).toBe('0.3');
  });
});

describe('unary operations', () => {
  it('square root', () => {
    expect(run(['9', 'sqrt'])).toBe('3');
  });
  it('square root of negative is Error', () => {
    expect(run(['4', 'negate', 'sqrt'])).toBe('Error');
  });
  it('square', () => {
    expect(run(['4', 'square'])).toBe('16');
  });
  it('reciprocal', () => {
    expect(run(['4', 'reciprocal'])).toBe('0.25');
  });
  it('reciprocal of zero is Error', () => {
    expect(run(['0', 'reciprocal'])).toBe('Error');
  });
  it('negate toggles sign', () => {
    expect(run(['5', 'negate'])).toBe('-5');
    expect(run(['5', 'negate', 'negate'])).toBe('5');
  });
});

describe('percent', () => {
  it('percent of the accumulator within a pending op', () => {
    expect(run(['2', '0', '0', '+', '1', '0', '%', '='])).toBe('220');
  });
  it('standalone percent divides by 100', () => {
    expect(run(['5', '0', '%'])).toBe('0.5');
  });
});

describe('edit keys and error recovery', () => {
  it('backspace removes the last digit', () => {
    expect(run(['1', '2', '3', 'back'])).toBe('12');
  });
  it('backspace to empty yields 0', () => {
    expect(run(['7', 'back'])).toBe('0');
  });
  it('CE clears the current entry only', () => {
    expect(run(['5', '+', '9', 'CE', '3', '='])).toBe('8');
  });
  it('C clears everything', () => {
    expect(run(['5', '+', '9', 'C'])).toBe('0');
  });
  it('typing a digit after Error starts fresh', () => {
    expect(run(['5', '÷', '0', '=', '7'])).toBe('7');
  });
});

describe('memory', () => {
  it('MS stores, MR recalls after clearing', () => {
    expect(run(['5', 'MS', 'C', 'MR'])).toBe('5');
  });
  it('M+ accumulates into memory', () => {
    expect(run(['5', 'MS', '3', 'M+', 'C', 'MR'])).toBe('8');
  });
  it('M- subtracts from memory', () => {
    expect(run(['1', '0', 'MS', '4', 'M-', 'C', 'MR'])).toBe('6');
  });
  it('MC clears memory back to 0', () => {
    expect(run(['5', 'MS', 'MC', 'C', 'MR'])).toBe('0');
  });
});
