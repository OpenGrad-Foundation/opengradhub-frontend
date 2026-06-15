"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator } from "@/components/calculator";

const TEAL = "#034852";
const WIDTH = 280;

/**
 * Draggable floating window that hosts the Calculator. Drag by the header bar;
 * close with the × button. Stays within the viewport.
 */
export function CalculatorWindow({ onClose }: { onClose: () => void }) {
  // Initial position: top-right area, inset from the edge. Set after mount so we
  // can read the viewport width (avoids SSR window access).
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 120 });
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    setPos((p) => ({ x: Math.max(16, window.innerWidth - WIDTH - 40), y: p.y }));
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - WIDTH - 8;
    const maxY = window.innerHeight - 80; // keep the header reachable
    return { x: Math.min(Math.max(8, x), Math.max(8, maxX)), y: Math.min(Math.max(8, y), Math.max(8, maxY)) };
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragOffset.current) return;
      setPos(clamp(e.clientX - dragOffset.current.dx, e.clientY - dragOffset.current.dy));
    }
    function onUp() {
      dragOffset.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clamp]);

  function onHeaderDown(e: React.MouseEvent) {
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }

  return (
    <div
      role="dialog"
      aria-label="Calculator"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: WIDTH,
        zIndex: 1000,
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 12px 40px rgba(3,72,82,0.28)",
        border: "1px solid rgba(3,72,82,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        onMouseDown={onHeaderDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: TEAL,
          color: "#fff",
          cursor: "move",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 700 }}>🧮 Calculator</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          style={{
            border: "none",
            background: "transparent",
            color: "#fff",
            fontSize: "18px",
            lineHeight: 1,
            cursor: "pointer",
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>
      <Calculator style={{ padding: "12px" }} />
    </div>
  );
}
