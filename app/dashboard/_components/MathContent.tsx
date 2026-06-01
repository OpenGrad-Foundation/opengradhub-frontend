"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";

// renderMathInElement is a UMD-style module — import as any, types not shipped
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renderMathInElement: ((el: HTMLElement, opts: any) => void) | null = null;

const AUTO_RENDER_OPTS = {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
    { left: "\\[", right: "\\]", display: true },
  ],
  throwOnError: false,
};

async function loadAutoRender() {
  if (renderMathInElement) return renderMathInElement;
  const mod = await import("katex/dist/contrib/auto-render.mjs" as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderMathInElement = (mod as any).default ?? (mod as any);
  return renderMathInElement!;
}

/**
 * Renders HTML content with inline KaTeX math.
 * Supports $...$ for inline and $$...$$ for display math.
 */
export function MathContent({
  html,
  style,
  className,
}: {
  html: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sanitize here so the component is safe regardless of caller. KaTeX
  // auto-render runs afterwards on the mounted node and is unaffected.
  const safeHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

  useEffect(() => {
    let cancelled = false;
    if (!ref.current) return;
    loadAutoRender().then((render) => {
      if (!cancelled && ref.current) render(ref.current, AUTO_RENDER_OPTS);
    });
    return () => { cancelled = true; };
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
