import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MathContent, MathSnippet } from "@/app/dashboard/_components/MathContent";

// KaTeX auto-render is loaded lazily from an .mjs bundle; stub it so the test
// exercises the markup, not the math typesetter.
vi.mock("katex/dist/contrib/auto-render.mjs", () => ({ default: () => {} }));

afterEach(cleanup);

/**
 * Bulk-imported questions, solutions and instructions are stored as text with
 * real newlines in them — a solution is a sequence of steps, and equations sit
 * on their own lines. HTML collapses whitespace, so without an explicit
 * white-space rule every one of those blocks renders as a single running line.
 */
describe("MathContent — authored line breaks", () => {
  const SOLUTION = "Step 1: Add them.\nSum = 6\n\nStep 2: Divide.\nAverage = 3";

  it("preserves newlines in the rendered block", () => {
    const { container } = render(<MathContent html={SOLUTION} />);
    const el = container.firstElementChild as HTMLElement;

    expect(getComputedStyle(el).whiteSpace).toBe("pre-wrap");
    expect(el.textContent).toBe(SOLUTION);
  });

  it("preserves newlines in the inline variant", () => {
    const { container } = render(<MathContent inline html={"a\nb"} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.tagName).toBe("SPAN");
    expect(getComputedStyle(el).whiteSpace).toBe("pre-wrap");
  });

  it("keeps caller styles working alongside the white-space rule", () => {
    const { container } = render(
      <MathContent html={SOLUTION} style={{ fontSize: "14px", lineHeight: 1.6 }} />,
    );
    const el = container.firstElementChild as HTMLElement;

    expect(getComputedStyle(el).whiteSpace).toBe("pre-wrap");
    expect(getComputedStyle(el).fontSize).toBe("14px");
  });

  it("preserves newlines in the clamped snippet variant", () => {
    const { container } = render(<MathSnippet html={SOLUTION} lines={2} />);
    const el = container.firstElementChild as HTMLElement;

    expect(getComputedStyle(el).whiteSpace).toBe("pre-wrap");
    expect(getComputedStyle(el).overflow).toBe("hidden");
  });

  it("leaves embedded markup intact", () => {
    const { container } = render(
      <MathContent html={'Look:\n<img src="https://x/y.png" alt="Extracted Image" />'} />,
    );

    expect(container.querySelector("img")).not.toBeNull();
  });
});
