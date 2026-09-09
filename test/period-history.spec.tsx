import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackerPeriodHistoryPage } from "@/lib/tracker-api";

let pages: TrackerPeriodHistoryPage[];
let calls: Array<{ before?: string }>;
let loading = false;

vi.mock("@/lib/queries/tracker", () => ({
  useRecordPeriodHistory: (_recordId: string | undefined, enabled: boolean, before?: string) => {
    calls.push({ before });
    const idx = before ? 1 : 0;
    return { data: enabled ? pages[idx] : undefined, isLoading: loading, isFetching: loading };
  },
}));

import { PeriodHistory } from "@/app/dashboard/tracker/_components/period-history";

const entry = (over: Partial<TrackerPeriodHistoryPage["entries"][number]> = {}) => ({
  record_id: "r-old", period_key: "2026-08-23", status: "done",
  lifecycle: "done" as const, updated_at: "2026-08-23T10:00:00.000Z",
  updated_by_name: "Fellow One", geo: null, ...over,
});

beforeEach(() => {
  calls = [];
  loading = false;
  pages = [{ entries: [entry()], next_cursor: null }, { entries: [], next_cursor: null }];
});

const renderHistory = (props: Partial<React.ComponentProps<typeof PeriodHistory>> = {}) =>
  render(<PeriodHistory recordId="r1" recurring {...props} />);

describe("PeriodHistory — visibility", () => {
  it("renders nothing for a one-time task", () => {
    const { container } = renderHistory({ recurring: false });
    expect(container.innerHTML).toBe("");
  });

  it("shows the previous period without being asked", () => {
    // The penultimate occurrence is visible by default; everything older is behind
    // a disclosure so a daily task does not dump a year of rows into the page.
    renderHistory();
    // Rendered through toLocaleDateString, so assert on the month rather than a
    // fixed day/month order that varies by locale. The date appears twice — as the
    // period label and in the "completed on" line.
    expect(screen.getAllByText(/Aug/i).length).toBeGreaterThan(0);
  });

  it("does not fetch until the row is actually shown", () => {
    render(<PeriodHistory recordId="r1" recurring={false} />);
    expect(calls.every((c) => c.before === undefined)).toBe(true);
  });
});

describe("PeriodHistory — states", () => {
  it("labels a completed past period as done", () => {
    renderHistory();
    expect(screen.getByText(/done/i)).toBeTruthy();
  });

  it("labels an incomplete past period as missed", () => {
    pages[0] = { entries: [entry({ lifecycle: "missed", status: "not_started" })], next_cursor: null };
    renderHistory();
    expect(screen.getByText(/missed/i)).toBeTruthy();
  });

  it("shows who completed it and when", () => {
    renderHistory();
    expect(screen.getByText(/Fellow One/)).toBeTruthy();
  });

  it("shows the visit verification a past period used", () => {
    pages[0] = {
      entries: [entry({
        geo: {
          id: "v1", status: "verified", accepted: true, distance_m: 34,
          radius_m: 200, exif_captured_at: "2026-08-23T04:00:00.000Z",
          preview_url: "https://signed.test/p.jpg",
        },
      })],
      next_cursor: null,
    };
    renderHistory();
    expect(screen.getByText(/34\s*m/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /visit photo/i })).toBeTruthy();
  });

  it("says so plainly when there is no earlier occurrence yet", () => {
    pages[0] = { entries: [], next_cursor: null };
    renderHistory();
    expect(screen.getByText(/no earlier/i)).toBeTruthy();
  });
});

describe("PeriodHistory — lazy loading", () => {
  beforeEach(() => {
    pages = [
      { entries: [entry({ period_key: "2026-08-23" })], next_cursor: "2026-08-23" },
      { entries: [entry({ period_key: "2026-08-22", record_id: "r-older" })], next_cursor: null },
    ];
  });

  it("offers to load older periods when more exist", () => {
    renderHistory();
    expect(screen.getByRole("button", { name: /earlier|older|more/i })).toBeTruthy();
  });

  it("fetches the next page with the cursor only after the user asks", async () => {
    renderHistory();
    expect(calls.some((c) => c.before === "2026-08-23")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /earlier|older|more/i }));
    await waitFor(() => expect(calls.some((c) => c.before === "2026-08-23")).toBe(true));
  });

  it("hides the button when the history is exhausted", () => {
    pages[0] = { entries: [entry()], next_cursor: null };
    renderHistory();
    expect(screen.queryByRole("button", { name: /earlier|older|more/i })).toBeNull();
  });
});
