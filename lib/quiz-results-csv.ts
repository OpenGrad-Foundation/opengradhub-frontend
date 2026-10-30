import type { QuizAttemptWithStudent } from "./api";
import { cell } from "./attendance-csv";

function duration(startedAt: string, submittedAt: string): string {
  const secs = Math.max(0, Math.round((Date.parse(submittedAt) - Date.parse(startedAt)) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h ? `${h} hrs ` : ""}${m} mins ${secs % 60} sec`;
}

/**
 * Submitted attempts in the shape programme teams already share as a mock-test
 * sheet. Every attempt is a row, best score first; in-progress attempts have no
 * result yet and are left out.
 */
export function quizResultsToCsv(attempts: QuizAttemptWithStudent[]): string {
  const head = ["Roll Number", "Name", "School", "Attempt", "Answered", "Score", "Total Score", "Accuracy", "Time Spent", "Submitted At (IST)"];
  const rows = attempts
    .filter((a) => a.is_complete && a.submitted_at)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.student_name.localeCompare(b.student_name))
    .map((a) => [
      a.roll_number ?? "",
      a.student_name,
      a.school_name ?? "",
      a.attempt_number,
      a.answered_count,
      a.score ?? "",
      a.max_score ?? "",
      a.answered_count ? `${((a.correct_count / a.answered_count) * 100).toFixed(2)}%` : "",
      duration(a.started_at, a.submitted_at!),
      new Date(a.submitted_at!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    ]);
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/** `<quiz-title>-results.csv`, safe for every OS. */
export function quizResultsFilename(title: string | undefined): string {
  const slug = (title ?? "quiz").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "quiz";
  return `${slug}-results.csv`;
}
