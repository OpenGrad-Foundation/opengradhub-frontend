"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The element in the workspace header, beside the bell, that page actions render into. */
export const HeaderActionsSlot = createContext<HTMLElement | null>(null);

/**
 * Renders a page's primary action(s) in the shared header, beside the bell,
 * instead of in a row of their own. Without a header slot (a page rendered
 * outside the shell, as in tests) the actions fall back to an in-page row.
 */
export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderActionsSlot);
  if (slot) return createPortal(children, slot);
  return <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>{children}</div>;
}
