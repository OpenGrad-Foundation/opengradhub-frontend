export type CalcOp = '+' | '−' | '×' | '÷';

export type CalcKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.' | '+' | '−' | '×' | '÷' | '=' | '%'
  | 'sqrt' | 'square' | 'reciprocal' | 'negate'
  | 'back' | 'CE' | 'C'
  | 'MC' | 'MR' | 'M+' | 'M-' | 'MS';

export interface CalcState {
  /** Currently displayed value (or "Error"). */
  display: string;
  /** Stored left operand for a pending binary op. */
  accumulator: number | null;
  /** Pending binary operator awaiting its right operand. */
  pendingOp: CalcOp | null;
  /** Memory register. */
  memory: number;
  /** When true, the next digit/decimal starts a fresh entry (overwrites display). */
  overwrite: boolean;
  /** True after an invalid operation (div-by-zero, sqrt of negative, etc.). */
  error: boolean;
}

export const initialCalcState: CalcState = {
  display: '0',
  accumulator: null,
  pendingOp: null,
  memory: 0,
  overwrite: true,
  error: false,
};

const DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

/** Trim floating-point noise; return "Error" for non-finite values. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  // toPrecision(12) collapses 0.1+0.2 -> "0.300000000000"; parseFloat strips zeros.
  return String(parseFloat(n.toPrecision(12)));
}

/** Reset the calculation but PRESERVE the memory register (only MC clears memory). */
function cleared(state: CalcState): CalcState {
  return { ...initialCalcState, memory: state.memory };
}

const OPS = new Set<CalcKey>(['+', '−', '×', '÷']);

/** Apply a binary op. Returns null for an invalid result (e.g. divide by zero). */
function compute(a: number, b: number, op: CalcOp): number | null {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
  }
}

export function applyKey(state: CalcState, key: CalcKey): CalcState {
  // Digit and decimal handling
  if (DIGITS.has(key)) {
    const base = state.error ? cleared(state) : state;
    if (base.overwrite) {
      return { ...base, display: key, overwrite: false, error: false };
    }
    const display = base.display === '0' ? key : base.display + key;
    return { ...base, display };
  }
  if (key === '.') {
    const base = state.error ? cleared(state) : state;
    if (base.overwrite) {
      return { ...base, display: '0.', overwrite: false, error: false };
    }
    if (base.display.includes('.')) return base;
    return { ...base, display: base.display + '.' };
  }

  if (OPS.has(key)) {
    const op = key as CalcOp;
    if (state.error) return state;
    const current = parseFloat(state.display);
    // A second operand was entered since the last op -> fold it in now.
    if (state.pendingOp !== null && !state.overwrite && state.accumulator !== null) {
      const result = compute(state.accumulator, current, state.pendingOp);
      if (result === null) return { ...state, display: 'Error', error: true, pendingOp: null, accumulator: null };
      return { ...state, display: formatNumber(result), accumulator: result, pendingOp: op, overwrite: true };
    }
    // No pending operand (or operator pressed consecutively): set/keep the left operand.
    return { ...state, accumulator: current, pendingOp: op, overwrite: true };
  }

  if (key === '=') {
    if (state.error || state.pendingOp === null || state.accumulator === null) return state;
    const current = parseFloat(state.display);
    const result = compute(state.accumulator, current, state.pendingOp);
    if (result === null) return { ...state, display: 'Error', error: true, pendingOp: null, accumulator: null };
    return { ...state, display: formatNumber(result), accumulator: null, pendingOp: null, overwrite: true };
  }

  if (key === 'sqrt' || key === 'square' || key === 'reciprocal') {
    if (state.error) return state;
    const current = parseFloat(state.display);
    let result: number | null;
    if (key === 'sqrt') result = current < 0 ? null : Math.sqrt(current);
    else if (key === 'square') result = current * current;
    else result = current === 0 ? null : 1 / current;
    if (result === null || !Number.isFinite(result)) return { ...state, display: 'Error', error: true };
    return { ...state, display: formatNumber(result), overwrite: true };
  }

  if (key === 'negate') {
    if (state.error || state.display === '0') return state;
    const current = parseFloat(state.display);
    return { ...state, display: formatNumber(-current) };
  }

  if (key === '%') {
    if (state.error) return state;
    const current = parseFloat(state.display);
    const pct = state.pendingOp !== null && state.accumulator !== null
      ? (state.accumulator * current) / 100
      : current / 100;
    return { ...state, display: formatNumber(pct), overwrite: false };
  }

  if (key === 'back') {
    if (state.error) return cleared(state);
    if (state.overwrite) return state;
    const next = state.display.slice(0, -1);
    const display = next === '' || next === '-' ? '0' : next;
    return { ...state, display };
  }

  if (key === 'CE') {
    return { ...state, display: '0', overwrite: true, error: false };
  }

  if (key === 'C') {
    return cleared(state);
  }

  if (key === 'MS') {
    if (state.error) return state;
    return { ...state, memory: parseFloat(state.display), overwrite: true };
  }
  if (key === 'M+') {
    if (state.error) return state;
    return { ...state, memory: state.memory + parseFloat(state.display), overwrite: true };
  }
  if (key === 'M-') {
    if (state.error) return state;
    return { ...state, memory: state.memory - parseFloat(state.display), overwrite: true };
  }
  if (key === 'MR') {
    return { ...state, display: formatNumber(state.memory), overwrite: true, error: false };
  }
  if (key === 'MC') {
    return { ...state, memory: 0 };
  }

  return state;
}
