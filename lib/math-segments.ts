/**
 * Scanner for `$…$` (inline) and `$$…$$` (display) LaTeX ranges inside
 * question content. Powers the MathTextEditor rendered view and its
 * click-to-edit source-range mapping. Unmatched delimiters are literal text;
 * single-$ pairs never span newlines (protects stray currency dollars).
 */

export type MathSegment =
  | { kind: "text"; value: string; start: number; end: number }
  | { kind: "math"; latex: string; display: boolean; start: number; end: number };

export function splitMathSegments(source: string): MathSegment[] {
  const segs: MathSegment[] = [];
  let textStart = 0;
  let i = 0;

  while (i < source.length) {
    if (source[i] !== "$") {
      i++;
      continue;
    }
    const isDisplay = source.startsWith("$$", i);
    const delim = isDisplay ? "$$" : "$";
    const close = source.indexOf(delim, i + delim.length);
    if (close === -1) {
      i += delim.length;
      continue;
    }
    const latex = source.slice(i + delim.length, close);
    if (latex.trim() === "" || (!isDisplay && latex.includes("\n"))) {
      i += delim.length;
      continue;
    }
    if (textStart < i) {
      segs.push({ kind: "text", value: source.slice(textStart, i), start: textStart, end: i });
    }
    const end = close + delim.length;
    segs.push({ kind: "math", latex, display: isDisplay, start: i, end });
    textStart = end;
    i = end;
  }

  if (textStart < source.length) {
    segs.push({ kind: "text", value: source.slice(textStart), start: textStart, end: source.length });
  }
  return segs;
}

/** Replace one math segment's latex in `source`. Empty latex deletes the segment. */
export function spliceMathSegment(
  source: string,
  seg: { start: number; end: number; display: boolean },
  newLatex: string,
): string {
  const trimmed = newLatex.trim();
  if (!trimmed) return source.slice(0, seg.start) + source.slice(seg.end);
  const d = seg.display ? "$$" : "$";
  return source.slice(0, seg.start) + d + trimmed + d + source.slice(seg.end);
}

/** Insert a new inline `$latex$` at `cursor`, padding with spaces against adjacent non-space text. */
export function insertEquation(source: string, cursor: number, latex: string): string {
  const pos = Math.max(0, Math.min(cursor, source.length));
  const before = source.slice(0, pos);
  const after = source.slice(pos);
  const padBefore = before && !/\s$/.test(before) ? " " : "";
  const padAfter = after && !/^\s/.test(after) ? " " : "";
  return `${before}${padBefore}$${latex.trim()}$${padAfter}${after}`;
}
