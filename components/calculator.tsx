"use client";

import { useEffect, useReducer } from "react";
import { initialCalcState, applyKey, formatNumber, type CalcKey, type CalcState } from "@/lib/calculator-engine";

function reducer(state: CalcState, key: CalcKey): CalcState {
  return applyKey(state, key);
}

// Layout rows of [label shown on button, key dispatched]. Some labels differ from keys.
// The 6th row has 4 buttons; the 5-column grid left-packs them, which is fine.
const ROWS: Array<Array<[string, CalcKey]>> = [
  [["MC", "MC"], ["MR", "MR"], ["M+", "M+"], ["M-", "M-"], ["MS", "MS"]],
  [["√", "sqrt"], ["x²", "square"], ["1/x", "reciprocal"], ["%", "%"], ["÷", "÷"]],
  [["7", "7"], ["8", "8"], ["9", "9"], ["CE", "CE"], ["×", "×"]],
  [["4", "4"], ["5", "5"], ["6", "6"], ["C", "C"], ["−", "−"]],
  [["1", "1"], ["2", "2"], ["3", "3"], ["⌫", "back"], ["+", "+"]],
  [["±", "negate"], ["0", "0"], [".", "."], ["=", "="]],
];

// Keyboard -> CalcKey map.
const KEY_MAP: Record<string, CalcKey> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
  "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
  ".": ".", "+": "+", "-": "−", "*": "×", "/": "÷",
  "Enter": "=", "=": "=", "%": "%", "Backspace": "back", "Escape": "C",
};

const TEAL = "#034852";

export function Calculator({ style }: { style?: React.CSSProperties }) {
  const [state, dispatch] = useReducer(reducer, initialCalcState);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mapped = KEY_MAP[e.key];
      if (!mapped) return;
      e.preventDefault();
      dispatch(mapped);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn: React.CSSProperties = {
    padding: "10px 0",
    borderRadius: "8px",
    border: "none",
    background: "rgba(3,72,82,0.06)",
    color: TEAL,
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  };
  const opBtn: React.CSSProperties = { ...btn, background: "rgba(3,72,82,0.12)" };

  // Expression preview: shows the stored left operand + pending operator
  // (e.g. "5 +") so it's clear which operation button was pressed.
  const expression =
    state.pendingOp !== null && state.accumulator !== null
      ? `${formatNumber(state.accumulator)} ${state.pendingOp}`
      : "";

  return (
    <div style={{ ...style }}>
      <div
        data-testid="calc-display"
        style={{
          background: TEAL,
          color: "#fff",
          borderRadius: "8px",
          padding: "12px",
          textAlign: "right",
          marginBottom: "10px",
          overflowX: "auto",
        }}
      >
        <div
          data-testid="calc-expression"
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: "13px",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            minHeight: "16px",
            lineHeight: "16px",
          }}
        >
          {expression}
        </div>
        <div
          style={{
            fontSize: "22px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {state.display}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateRows: "repeat(6, auto)", gap: "6px" }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
            {row.map(([label, key], ci) => {
              const isOp = key === "+" || key === "−" || key === "×" || key === "÷" || key === "=";
              return (
                <button
                  key={ci}
                  type="button"
                  aria-label={label}
                  onClick={() => dispatch(key)}
                  style={isOp ? opBtn : btn}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
