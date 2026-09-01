import type { ParsedBulkQuiz, ParsedQuestion, ParseDiagnostic } from "@/lib/api";

/**
 * Source-level repairs: turn a diagnostic into an edit of the quiz TEXT.
 *
 * The structured preview fixes fields on the parsed tree; here the fix is a
 * text transformation the author would have typed themselves, so it works for
 * every diagnostic that has a line — including ones the tree cannot express
 * (a missing tag line, a typo tag after an option). Reparsing the result is
 * the caller's job.
 */

export type SourceFixResult = {
  text: string;
  /** 1-based line to focus after the edit (where the author may need to type). */
  cursorLine: number;
  /** True when the edit left a value for the author to fill in. */
  needsInput?: boolean;
};

/** Human label for the button; null = no safe automatic repair, only "go to line". */
export function sourceFixLabel(diag: ParseDiagnostic): string | null {
  switch (diag.code) {
    case "UNKNOWN_TAG":
    case "UNKNOWN_BRACKET_LINE":
      return diag.suggestedTag && diag.line ? `Rename to [${diag.suggestedTag}]` : null;
    case "UNBRACKETED_TAG":
      return diag.suggestedTag && diag.line ? `Bracket as [${diag.suggestedTag}]` : null;
    case "VALUE_TRIMMED":
      return diag.line ? "Remove stray colon" : null;
    case "MISSING_SUBJECT":
      return "Add [SUBJECT] line";
    case "MISSING_TOPIC":
      return "Add [TOPIC] line";
    case "MISSING_DIFFICULTY":
      return "Add [DIFFICULTY] line";
    case "MISSING_TITLE":
      return "Add [TEST TITLE] line";
    case "MISSING_DURATION":
      return "Add [TEST DURATION] line";
    case "TYPE_INFERRED":
      return "Add [QUESTION TYPE] line";
    case "DIFFICULTY_NONCANONICAL":
    case "DIFFICULTY_UNKNOWN":
      return diag.fix?.value != null ? `Set to ${String(diag.fix.value)}` : null;
    default:
      return null;
  }
}

const BLOCK_BOUNDARY = /^(Q\.\d+\)|\[SECTION\]|\[GROUP START\]|\[GROUP END\]|i\.\d+)/i;

const locate = (quiz: ParsedBulkQuiz | null, diag: ParseDiagnostic): ParsedQuestion | null => {
  const w = diag.where;
  if (!quiz || w === "quiz" || !("q" in w)) return null;
  const q = quiz.sections[w.s]?.questions?.[w.q];
  if (!q) return null;
  return w.child != null ? q.children?.[w.child] ?? null : q;
};

/**
 * Index (0-based) of the line where a new metadata line for `question` should
 * go: just before the next block boundary after the question's own line,
 * skipping trailing blank lines so the tag sits with its question.
 */
function insertionIndexFor(lines: string[], question: ParsedQuestion): number | null {
  if (question.line == null) return null;
  let i = question.line; // 0-based index of the line AFTER the Q.n) line
  while (i < lines.length && !BLOCK_BOUNDARY.test(lines[i].trim())) i++;
  // Back up over blank lines.
  while (i > question.line && lines[i - 1].trim() === "") i--;
  return i;
}

/**
 * Applies the source-level repair for `diag` to `source`. Returns null when no
 * automatic repair is safe (the caller falls back to "go to line").
 */
export function applySourceFix(
  source: string,
  diag: ParseDiagnostic,
  quiz: ParsedBulkQuiz | null,
): SourceFixResult | null {
  const lines = source.split("\n");
  const at = diag.line != null ? diag.line - 1 : -1;
  const lineOk = at >= 0 && at < lines.length;

  switch (diag.code) {
    case "UNKNOWN_TAG":
    case "UNKNOWN_BRACKET_LINE": {
      if (!diag.suggestedTag || !lineOk) return null;
      const m = lines[at].match(/^(\s*)\*?\[[^\]]+\](.*)$/);
      if (!m) return null;
      lines[at] = `${m[1]}[${diag.suggestedTag}]${m[2]}`;
      return { text: lines.join("\n"), cursorLine: at + 1 };
    }
    case "UNBRACKETED_TAG": {
      if (!diag.suggestedTag || !lineOk) return null;
      const m = lines[at].match(/^(\s*)[A-Za-z ]+?\s*[:\-]\s*(.*)$/);
      if (!m) return null;
      lines[at] = `${m[1]}[${diag.suggestedTag}] ${m[2]}`;
      return { text: lines.join("\n"), cursorLine: at + 1 };
    }
    case "VALUE_TRIMMED": {
      if (!lineOk) return null;
      const next = lines[at].replace(/^(\s*\[[^\]]+\])\s*:\s*/, "$1 ");
      if (next === lines[at]) return null;
      lines[at] = next;
      return { text: lines.join("\n"), cursorLine: at + 1 };
    }
    case "MISSING_TITLE": {
      lines.unshift("[TEST TITLE] ");
      return { text: lines.join("\n"), cursorLine: 1, needsInput: true };
    }
    case "MISSING_DURATION": {
      // After the title if there is one, else at the top.
      const titleIdx = lines.findIndex((l) => /^\[TEST TITLE\]/i.test(l.trim()));
      const idx = titleIdx >= 0 ? titleIdx + 1 : 0;
      lines.splice(idx, 0, "[TEST DURATION] ");
      return { text: lines.join("\n"), cursorLine: idx + 1, needsInput: true };
    }
    case "MISSING_SUBJECT":
    case "MISSING_TOPIC":
    case "MISSING_DIFFICULTY": {
      const q = locate(quiz, diag);
      if (!q) return null;
      const idx = insertionIndexFor(lines, q);
      if (idx == null) return null;
      const tag = diag.code === "MISSING_SUBJECT" ? "SUBJECT" : diag.code === "MISSING_TOPIC" ? "TOPIC" : "DIFFICULTY";
      lines.splice(idx, 0, `[${tag}] `);
      return { text: lines.join("\n"), cursorLine: idx + 1, needsInput: true };
    }
    case "TYPE_INFERRED": {
      const q = locate(quiz, diag);
      if (!q || q.line == null) return null;
      const label = q.question_type === "NUMERICAL" ? "Numerical" : q.question_type === "FILL" ? "Fill" : null;
      if (!label) return null;
      lines.splice(q.line, 0, `[QUESTION TYPE] ${label}`); // right after the Q.n) line
      return { text: lines.join("\n"), cursorLine: q.line + 1 };
    }
    case "DIFFICULTY_NONCANONICAL":
    case "DIFFICULTY_UNKNOWN": {
      const q = locate(quiz, diag);
      const value = diag.fix?.value;
      if (!q || q.line == null || value == null) return null;
      // Find the [DIFFICULTY] line inside this question's block.
      let i = q.line;
      while (i < lines.length && !BLOCK_BOUNDARY.test(lines[i].trim())) {
        if (/^\[DIFFICULTY\]/i.test(lines[i].trim())) {
          lines[i] = lines[i].replace(/^(\s*\[DIFFICULTY\])\s*:?\s*.*$/i, `$1 ${String(value)}`);
          return { text: lines.join("\n"), cursorLine: i + 1 };
        }
        i++;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Best line to jump to for a diagnostic without its own `line`. */
export function diagnosticJumpLine(diag: ParseDiagnostic, quiz: ParsedBulkQuiz | null): number | null {
  if (diag.line != null) return diag.line;
  const w = diag.where;
  if (w === "quiz") return 1;
  if (!("q" in w)) return quiz?.sections[w.s]?.line ?? null;
  return locate(quiz, diag)?.line ?? null;
}
