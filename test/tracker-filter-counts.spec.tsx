import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskListView } from "@/app/dashboard/tracker/_components/my-tasks";
import type { TrackerMyTask } from "@/lib/tracker-api";

/**
 * The status cards must describe the list underneath them.
 *
 * They did not: the counts were built from every task while the list below was
 * filtered, so choosing a school left the cards claiming work that was no longer on
 * screen. A card is a promise that clicking it shows you those rows — a number you
 * cannot reach is worse than no number at all.
 */

vi.mock("@/lib/queries/tracker", () => ({ useTrackerMyTasks: () => ({ data: [], isLoading: false, error: null }) }));

const task = (over: Partial<TrackerMyTask>): TrackerMyTask => ({
  record_id: Math.random().toString(36).slice(2),
  template_id: over.template_id ?? Math.random().toString(36).slice(2),
  name: "Task",
  target_name: null,
  school_name: "School A",
  school_id: "school-a",
  issued_at: "2026-08-01T09:00:00.000Z",
  deadline: null,
  target_type: "school",
  priority: "medium",
  status: "not_started",
  blocked: false,
  lifecycle: "not_started",
  require_photo: false,
  require_location: false,
  has_photo_proof: false,
  has_location_proof: false,
  ...over,
});

/** School and proof live behind "Add filter", where the long tail of controls goes. */
function openExtraFilters(): void {
  fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));
}

/** The number rendered on a named status card. Scoped to the card strip, since the
 *  status dropdown carries the same four words. */
function cardCount(label: string): number {
  const card = screen.getByRole("button", { name: new RegExp(`^${label}\\s*\\d+$`, "i") });
  return Number(card.textContent?.match(/\d+/)?.[0] ?? -1);
}

describe("My Tasks status cards", () => {
  it("counts only the tasks the other filters admit", () => {
    render(
      <TaskListView
        tasks={[
          task({ template_id: "a", school_id: "school-a", lifecycle: "done" }),
          task({ template_id: "b", school_id: "school-b", lifecycle: "not_started" }),
          task({ template_id: "c", school_id: "school-b", lifecycle: "not_started" }),
        ]}
        onOpen={() => {}}
      />,
    );

    expect(cardCount("Done")).toBe(1);
    expect(cardCount("Pending")).toBe(2);

    // Narrow to school B: the one done task belongs to A and must leave the cards too.
    openExtraFilters();
    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-b" } });
    expect(cardCount("Done")).toBe(0);
    expect(cardCount("Pending")).toBe(2);
  });

  it("leaves its own status filter out of the counts, so every card stays reachable", () => {
    render(
      <TaskListView
        tasks={[
          task({ template_id: "a", lifecycle: "done" }),
          task({ template_id: "b", lifecycle: "not_started" }),
        ]}
        onOpen={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });
    // The list now shows only the done task, but Pending must still offer its 1 —
    // zeroing it would strand the user with no way back.
    expect(cardCount("Done")).toBe(1);
    expect(cardCount("Pending")).toBe(1);
  });
});

describe("My Tasks record-level filters run before grouping", () => {
  it("keeps a task whose records span schools when one of them matches", () => {
    // One task, two records in different schools. Filtering by school B must keep the
    // task (it has work there) — asking "is this task in school B" of a task spanning
    // two would answer no.
    render(
      <TaskListView
        tasks={[
          task({ template_id: "shared", name: "Shared task", school_id: "school-a" }),
          task({ template_id: "shared", name: "Shared task", school_id: "school-b" }),
        ]}
        onOpen={() => {}}
      />,
    );
    openExtraFilters();
    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-b" } });
    expect(screen.getByText(/Shared task/)).toBeTruthy();
  });

  it("filters on missing proof only where the template asked for it", () => {
    render(
      <TaskListView
        tasks={[
          task({ template_id: "needs", name: "Needs photo", require_photo: true, has_photo_proof: false }),
          task({ template_id: "has", name: "Has photo", require_photo: true, has_photo_proof: true }),
          task({ template_id: "none", name: "Wants nothing" }),
        ]}
        onOpen={() => {}}
      />,
    );
    openExtraFilters();
    fireEvent.click(screen.getByLabelText("Missing photo/location proof"));
    expect(screen.getByText(/Needs photo/)).toBeTruthy();
    expect(screen.queryByText(/Has photo/)).toBeNull();
    expect(screen.queryByText(/Wants nothing/)).toBeNull();
  });
});
