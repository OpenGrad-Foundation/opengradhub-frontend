import { describe, it, expect } from "vitest";
import { quizResultsToCsv, quizResultsFilename } from "@/lib/quiz-results-csv";
import type { QuizAttemptWithStudent } from "@/lib/api";

const base: QuizAttemptWithStudent = {
  id: "a1", quiz_id: "q1", student_id: "s1", student_name: "Kamali E", roll_number: "OG1",
  school_name: "GGHSS, Nellikuppam", attempt_number: 1, score: 17, max_score: 32,
  answered_count: 19, correct_count: 17,
  started_at: "2026-10-24T14:06:04Z", submitted_at: "2026-10-24T14:41:05Z",
  is_complete: true, passed: null, counts_toward_grade: true,
};

describe("quizResultsToCsv", () => {
  const csv = quizResultsToCsv([
    base,
    { ...base, id: "a2", student_id: "s2", student_name: "=HYPERLINK(\"x\")", score: 31, answered_count: 32, correct_count: 31,
      started_at: "2026-10-24T14:00:00Z", submitted_at: "2026-10-24T15:15:18Z" },
    { ...base, id: "a3", attempt_number: 2, is_complete: false, submitted_at: null, score: null },
  ]);
  const lines = csv.split("\r\n");

  it("lists submitted attempts best score first and drops in-progress ones", () => {
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(",31,32,");
    expect(lines[2]).toContain(",17,32,");
  });

  it("quotes commas, computes accuracy over answered, formats time", () => {
    expect(lines[2]).toContain('"GGHSS, Nellikuppam"');
    expect(lines[2]).toContain("89.47%");
    expect(lines[2]).toContain("35 mins 1 sec");
    expect(lines[1]).toContain("1 hrs 15 mins 18 sec");
    // 14:41:05Z is 8:11:05 pm IST on every exporter's machine.
    expect(lines[2]).toMatch(/8:11:05\s?pm/i);
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("builds a safe filename", () => {
    expect(quizResultsFilename("CLAT Mock Test: Reading, Legal")).toBe("CLAT-Mock-Test-Reading-Legal-results.csv");
    expect(quizResultsFilename(undefined)).toBe("quiz-results.csv");
  });
});
