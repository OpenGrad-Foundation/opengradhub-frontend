"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/**
 * Row-level navigation that does not cost the anchor's behaviour.
 *
 * The name in the row stays a real `<Link>`, so keyboard tabbing, cmd/middle-click
 * into a new tab, "copy link address" and screen-reader link semantics all keep
 * working — a `<tr onClick>` alone silently removes every one of those. This only
 * adds the convenience click, and stands aside whenever the browser is already
 * doing something better:
 *
 *   - a modifier or non-left button      -> the anchor's own new-tab handling
 *   - a click on any interactive child   -> that control's job, not ours
 *   - a click that ends a text selection -> the user was selecting, not navigating
 *
 * No tabIndex/role on the row: that would add a second tab stop announcing the
 * same destination the name link already announces.
 *
 * Extracted from the programmes list so the hub's tables cannot drift into a
 * second, worse answer to the same problem.
 */
export function useRowNavigation() {
  const router = useRouter();
  return (href: string | null) => {
    if (!href) return {};
    return {
      onClick: (e: MouseEvent<HTMLTableRowElement>) => {
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      },
      style: { cursor: "pointer" as const },
    };
  };
}
