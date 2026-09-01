import type {
  ParsedBulkQuiz,
  ParsedQuestion,
  ParseDiagnostic,
  ParseDiagnosticWhere,
} from "@/lib/api";

/**
 * Client-side plumbing for bulk-import diagnostics.
 *
 * Two populations, kept in separate buckets by the preview:
 *  - SYNTACTIC — line-anchored, produced only by the parser. They cannot be
 *    regenerated from the parsed structure (the misparse they describe was
 *    prevented, or the line is quarantined inside the diagnostic), so they are
 *    resolved explicitly: apply / append / discard / (warnings) ignore.
 *  - SEMANTIC — structure-derived, produced by POST /quizzes/bulk-validate.
 *    Replaced wholesale on every re-validate; never resolved by hand.
 */
export const SEMANTIC_CODES = new Set([
  "MISSING_TITLE", "MISSING_DURATION", "DURATION_NAN",
  "SECTION_EMPTY", "EMPTY_CONTENT", "GROUP_NO_CHILDREN",
  "MCQ_NO_CORRECT", "MCQ_TOO_FEW_OPTIONS",
  "NUMERICAL_ANSWER_NAN", "FILL_NO_ANSWER",
  "MARKS_NAN", "MARKS_INCONSISTENT",
  "MISSING_SUBJECT", "MISSING_TOPIC", "MISSING_DIFFICULTY",
  "DIFFICULTY_NONCANONICAL", "DIFFICULTY_UNKNOWN", "GROUP_NO_CONTENT",
]);

/** Codes that mean the parse tree itself may be wrong — offer source repair. */
export const STRUCTURAL_CODES = new Set([
  "UNKNOWN_TAG", "UNKNOWN_TYPE", "QUESTION_NUMBER_GAP",
  "SECTION_EMPTY", "EMPTY_CONTENT", "MCQ_TOO_FEW_OPTIONS", "GROUP_NO_CHILDREN",
]);

export const isSyntactic = (d: ParseDiagnostic): boolean => !SEMANTIC_CODES.has(d.code);

export const splitDiagnostics = (all: ParseDiagnostic[]) => ({
  syntactic: all.filter(isSyntactic),
  semantic: all.filter((d) => !isSyntactic(d)),
});

export const hasStructuralIssue = (all: ParseDiagnostic[]): boolean =>
  all.some((d) => STRUCTURAL_CODES.has(d.code) && d.severity !== "info");

/** Stable string key for a diagnostic's location, for grouping/badges. */
export function whereKey(w: ParseDiagnosticWhere): string {
  if (w === "quiz") return "quiz";
  if ("q" in w) return w.child != null ? `s${w.s}q${w.q}c${w.child}` : `s${w.s}q${w.q}`;
  return `s${w.s}`;
}

/** All diagnostics that sit on question (sIdx,qIdx) — its children included. */
export function diagsForQuestion(all: ParseDiagnostic[], sIdx: number, qIdx: number): ParseDiagnostic[] {
  return all.filter((d) =>
    typeof d.where === "object" && "q" in d.where && d.where.s === sIdx && d.where.q === qIdx,
  );
}

export function countBySeverity(all: ParseDiagnostic[]): { errors: number; warnings: number; infos: number } {
  let errors = 0, warnings = 0, infos = 0;
  for (const d of all) {
    if (d.severity === "error") errors++;
    else if (d.severity === "warning") warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}

// ── Fix application ──────────────────────────────────────────────────────────

const locateQuestion = (quiz: ParsedBulkQuiz, w: ParseDiagnosticWhere): ParsedQuestion | null => {
  if (w === "quiz" || !("q" in w)) return null;
  const q = quiz.sections[w.s]?.questions?.[w.q];
  if (!q) return null;
  return w.child != null ? q.children?.[w.child] ?? null : q;
};

/** Removes the `occurrence`-th exact-match line from a text block. */
export function stripOccurrence(text: string, rawLine: string, occurrence: number): string {
  const lines = text.split("\n");
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === rawLine) {
      if (seen === occurrence) {
        lines.splice(i, 1);
        return lines.join("\n");
      }
      seen++;
    }
  }
  return text; // occurrence no longer present (user already edited) → no-op
}

export type FixMode = "apply" | "append" | "discard";

/**
 * Applies one resolution to a diagnostic, immutably. Returns the new quiz, or
 * null when the diagnostic has nothing to change for that mode (still counts
 * as resolved — e.g. discarding an already-quarantined line).
 *
 *  - apply:   set `fix.field = fix.value`; for op "move", also strip the raw
 *             line from `fix.from`.
 *  - append:  add the quarantined `raw` line to the question's content
 *             (for UNKNOWN_TAG, whose line is not in the data).
 *  - discard: strip the raw line from `fix.from` when it is in the data
 *             (op move/discard); no-op for a quarantined line.
 */
export function applyDiagnosticFix(
  quiz: ParsedBulkQuiz,
  diag: ParseDiagnostic,
  mode: FixMode,
): ParsedBulkQuiz | null {
  const w = diag.where;
  if (w === "quiz" || !("q" in w)) return null;
  const target = locateQuestion(quiz, w);
  if (!target) return null;

  const patch = (updater: (q: ParsedQuestion) => ParsedQuestion): ParsedBulkQuiz => ({
    ...quiz,
    sections: quiz.sections.map((sec, si) => {
      if (si !== w.s) return sec;
      return {
        ...sec,
        questions: sec.questions.map((q, qi) => {
          if (qi !== w.q) return q;
          if (w.child == null) return updater(q);
          return {
            ...q,
            children: (q.children ?? []).map((c, ci) => (ci === w.child ? updater(c) : c)),
          };
        }),
      };
    }),
  });

  if (mode === "append") {
    if (!diag.raw) return null;
    const raw = diag.raw;
    return patch((q) => ({ ...q, content: q.content ? `${q.content}\n${raw}` : raw }));
  }

  if (mode === "discard") {
    const { fix } = diag;
    if (!fix?.from || fix.occurrence == null || !diag.raw) return null; // quarantined → nothing to remove
    const { from, occurrence } = fix;
    const raw = diag.raw;
    return patch((q) => ({
      ...q,
      [from]: stripOccurrence(((q[from] as string | undefined) ?? ""), raw, occurrence),
    }));
  }

  // mode === "apply"
  const { fix } = diag;
  if (!fix?.field || fix.value == null) return null;
  const { field, value } = fix;
  return patch((q) => {
    let next: ParsedQuestion = { ...q, [field]: value };
    if (fix.op === "move" && fix.from && fix.occurrence != null && diag.raw) {
      const cur = (next[fix.from] as string | undefined) ?? "";
      next = { ...next, [fix.from]: stripOccurrence(cur, diag.raw, fix.occurrence) };
    }
    return next;
  });
}

// ── Grouping (cascader / tree view) ─────────────────────────────────────────

export type DiagGroup = {
  key: string;
  label: string;
  /** Source line to jump to for the group header, when known. */
  line?: number;
  /** Address of the question this group stands for (for "open in panel"). */
  address?: { sIdx: number; qIdx: number };
  items: ParseDiagnostic[];
  children: DiagGroup[];
  counts: { errors: number; warnings: number };
};

const preview = (s: string | undefined, n = 42): string => {
  const t = (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const tally = (g: DiagGroup): DiagGroup["counts"] => {
  const own = countBySeverity(g.items);
  const kids = g.children.map(tally);
  g.counts = {
    errors: own.errors + kids.reduce((a, c) => a + c.errors, 0),
    warnings: own.warnings + kids.reduce((a, c) => a + c.warnings, 0),
  };
  return g.counts;
};

/**
 * Arranges diagnostics as Quiz → Section → Question (→ child) so a long
 * list can be folded. Groups with nothing in them are dropped; a diagnostic
 * whose address no longer exists in `quiz` falls back to the quiz root.
 */
export function groupDiagnostics(quiz: ParsedBulkQuiz | null, diags: ParseDiagnostic[]): DiagGroup[] {
  const root: DiagGroup = { key: "quiz", label: "Quiz", line: 1, items: [], children: [], counts: { errors: 0, warnings: 0 } };
  const sections = new Map<number, DiagGroup>();
  const questions = new Map<string, DiagGroup>();

  const sectionGroup = (s: number): DiagGroup => {
    let g = sections.get(s);
    if (!g) {
      const sec = quiz?.sections[s];
      g = {
        key: `s${s}`, label: sec ? `Section: ${sec.title}` : `Section ${s + 1}`, line: sec?.line,
        items: [], children: [], counts: { errors: 0, warnings: 0 },
      };
      sections.set(s, g);
    }
    return g;
  };
  const questionGroup = (s: number, q: number): DiagGroup => {
    const k = `s${s}q${q}`;
    let g = questions.get(k);
    if (!g) {
      const qq = quiz?.sections[s]?.questions?.[q];
      const label = !qq
        ? `Question ${q + 1}`
        : qq.question_type === "GROUP"
          ? `Group: ${preview(qq.content) || "(passage)"}`
          : `Q.${qq.number ?? q + 1} ${preview(qq.content)}`.trim();
      g = { key: k, label, line: qq?.line, address: { sIdx: s, qIdx: q }, items: [], children: [], counts: { errors: 0, warnings: 0 } };
      questions.set(k, g);
      sectionGroup(s).children.push(g);
    }
    return g;
  };
  const childGroup = (s: number, q: number, c: number): DiagGroup => {
    const parent = questionGroup(s, q);
    const k = `s${s}q${q}c${c}`;
    let g = parent.children.find((x) => x.key === k);
    if (!g) {
      const cq = quiz?.sections[s]?.questions?.[q]?.children?.[c];
      g = {
        key: k, label: cq ? `Q.${cq.number ?? c + 1} ${preview(cq.content)}`.trim() : `Child ${c + 1}`,
        line: cq?.line, address: { sIdx: s, qIdx: q }, items: [], children: [], counts: { errors: 0, warnings: 0 },
      };
      parent.children.push(g);
    }
    return g;
  };

  for (const d of diags) {
    const w = d.where;
    if (w === "quiz") root.items.push(d);
    else if (!("q" in w)) sectionGroup(w.s).items.push(d);
    else if (w.child != null) childGroup(w.s, w.q, w.child).items.push(d);
    else questionGroup(w.s, w.q).items.push(d);
  }

  const out: DiagGroup[] = [];
  if (root.items.length) out.push(root);
  for (const s of [...sections.keys()].sort((a, b) => a - b)) {
    const g = sections.get(s)!;
    g.children.sort((a, b) => (a.address?.qIdx ?? 0) - (b.address?.qIdx ?? 0));
    out.push(g);
  }
  out.forEach(tally);
  return out;
}
