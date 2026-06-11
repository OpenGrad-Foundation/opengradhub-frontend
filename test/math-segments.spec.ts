import { describe, it, expect } from "vitest";
import {
  splitMathSegments,
  spliceMathSegment,
  insertEquation,
  type MathSegment,
} from "@/lib/math-segments";

function mathSegs(source: string) {
  return splitMathSegments(source).filter(s => s.kind === "math") as Extract<
    MathSegment,
    { kind: "math" }
  >[];
}

describe("splitMathSegments", () => {
  it("returns one text segment for plain text", () => {
    expect(splitMathSegments("hello world")).toEqual([
      { kind: "text", value: "hello world", start: 0, end: 11 },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(splitMathSegments("")).toEqual([]);
  });

  it("extracts a single inline equation with surrounding text", () => {
    const segs = splitMathSegments("Solve $4x^{2}$ for x");
    expect(segs).toEqual([
      { kind: "text", value: "Solve ", start: 0, end: 6 },
      { kind: "math", latex: "4x^{2}", display: false, start: 6, end: 14 },
      { kind: "text", value: " for x", start: 14, end: 20 },
    ]);
  });

  it("extracts display math with $$ delimiters", () => {
    const segs = splitMathSegments("Area: $$\\int_a^b f(x)dx$$");
    expect(segs[1]).toEqual({
      kind: "math",
      latex: "\\int_a^b f(x)dx",
      display: true,
      start: 6,
      end: 25,
    });
  });

  it("handles multiple equations", () => {
    const segs = mathSegs("$a$ plus $b$ equals $c$");
    expect(segs.map(s => s.latex)).toEqual(["a", "b", "c"]);
  });

  it("treats an unmatched $ as literal text", () => {
    expect(splitMathSegments("costs $5 total")).toEqual([
      { kind: "text", value: "costs $5 total", start: 0, end: 14 },
    ]);
  });

  it("does not pair single-$ across newlines", () => {
    const segs = splitMathSegments("price $5\nand $3 off");
    expect(segs.every(s => s.kind === "text")).toBe(true);
  });

  it("equation at the very start and end", () => {
    const segs = splitMathSegments("$x$");
    expect(segs).toEqual([
      { kind: "math", latex: "x", display: false, start: 0, end: 3 },
    ]);
  });

  it("source reconstructs from segment ranges", () => {
    const src = "a $x$ b $$y$$ c";
    const joined = splitMathSegments(src)
      .map(s => src.slice(s.start, s.end))
      .join("");
    expect(joined).toBe(src);
  });
});

describe("spliceMathSegment", () => {
  const src = "Solve $4x$ now";
  const seg = { start: 6, end: 10, display: false };

  it("replaces the equation latex in place", () => {
    expect(spliceMathSegment(src, seg, "9y^{3}")).toBe("Solve $9y^{3}$ now");
  });

  it("keeps $$ delimiters for display segments", () => {
    const dsrc = "A $$x$$ B";
    expect(spliceMathSegment(dsrc, { start: 2, end: 7, display: true }, "y"))
      .toBe("A $$y$$ B");
  });

  it("removes the equation entirely when new latex is empty", () => {
    expect(spliceMathSegment(src, seg, "  ")).toBe("Solve  now");
  });
});

describe("insertEquation", () => {
  it("inserts wrapped equation at cursor with spacing", () => {
    expect(insertEquation("Solve for x", 6, "4x")).toBe("Solve $4x$ for x");
  });

  it("appends at end when cursor is past the end", () => {
    expect(insertEquation("Solve", 99, "x")).toBe("Solve $x$");
  });

  it("inserts into empty string without padding", () => {
    expect(insertEquation("", 0, "x")).toBe("$x$");
  });
});
