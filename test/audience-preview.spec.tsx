import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudienceCount } from "@/components/AudienceCount";

/**
 * Live-class filters AND together, so "students enrolled in X AND in the UG
 * programme AND in 2 batches" reads identically whether it matches forty
 * students or nobody. Zero is the answer that matters, and it is the one the
 * prose cannot say.
 */

const p = (over: Partial<{ data: { total: number; untrackable: number }; isFetching: boolean; error: unknown }> = {}) => ({
  data: undefined,
  isFetching: false,
  error: null,
  ...over,
});

describe("the audience count says what the sentence cannot", () => {
  it("calls out an empty intersection in the danger colour", () => {
    render(<AudienceCount preview={p({ data: { total: 0, untrackable: 0 } })} />);
    const line = screen.getByText(/nobody would see this class/i);
    expect(line).toBeTruthy();
    expect(line.style.color).toBe("rgb(198, 40, 40)");
  });

  it("states the match count when there is one", () => {
    render(<AudienceCount preview={p({ data: { total: 42, untrackable: 0 } })} />);
    expect(screen.getByText(/42 students match/i)).toBeTruthy();
  });

  it("uses the singular for exactly one student", () => {
    render(<AudienceCount preview={p({ data: { total: 1, untrackable: 0 } })} />);
    expect(screen.getByText(/^1 student match\.$/i)).toBeTruthy();
  });

  it("warns about students who are in no batch, without blocking", () => {
    render(<AudienceCount preview={p({ data: { total: 10, untrackable: 3 } })} />);
    // Not a blocker: the class is still worth scheduling, their attendance just
    // reads as not-recorded rather than a false absent.
    expect(screen.getByText(/3 of them are in no batch/i)).toBeTruthy();
  });

  it("does not repeat the batch warning when nobody matches at all", () => {
    render(<AudienceCount preview={p({ data: { total: 0, untrackable: 0 } })} />);
    expect(screen.queryByText(/in no batch/i)).toBeNull();
  });

  it("degrades to a note rather than blocking the form when the count fails", () => {
    render(<AudienceCount preview={p({ error: new Error("boom") })} />);
    expect(screen.getByText(/can still be scheduled/i)).toBeTruthy();
  });
});
