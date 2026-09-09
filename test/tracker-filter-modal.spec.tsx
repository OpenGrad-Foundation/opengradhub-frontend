import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "@/app/dashboard/tracker/_components/filter-bar";
import type { FilterDef, FilterState } from "@/lib/filters";

describe("FilterBar extra filters modal", () => {
  const spec: FilterDef<never>[] = [
    { key: "q", urlKey: "q", apiKey: "q", label: "Search", kind: "text" },
    { key: "status", urlKey: "status", apiKey: "status", label: "Status", kind: "select", options: [{ value: "done", label: "Done" }] },
    { key: "school", urlKey: "school", apiKey: "schoolId", label: "School", kind: "select", options: [{ value: "s1", label: "School 1" }] },
    { key: "period", urlKey: "period", apiKey: "period", label: "Period", kind: "select", options: [{ value: "p1", label: "Period 1" }] },
    { key: "issued", urlKey: "issued", apiKey: "issued", label: "Issued", kind: "daterange" },
    { key: "evidence", urlKey: "evidence", apiKey: "hasEvidence", label: "Has photo or location", kind: "toggle" },
  ];

  it("opens the modal and renders all extra filter controls cleanly", () => {
    const state: FilterState = {};
    const set = vi.fn();
    const clear = vi.fn();

    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <FilterBar
          spec={spec}
          state={state}
          set={set}
          clear={clear}
          activeCount={0}
          primaryKeys={["q"]}
        />
      </div>
    );

    // Initially modal is closed
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click "Add filter"
    fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Check header
    expect(screen.getByText("Filters")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close filters" })).toBeTruthy();

    // Check controls
    expect(screen.getByLabelText("Status")).toBeTruthy();
    expect(screen.getByLabelText("School")).toBeTruthy();
    expect(screen.getByLabelText("Period")).toBeTruthy();
    expect(screen.getByLabelText("Issued from")).toBeTruthy();
    expect(screen.getByLabelText("Issued to")).toBeTruthy();

    // Check toggle has single label and is not duplicated
    const toggleLabels = screen.getAllByText("Has photo or location");
    expect(toggleLabels).toHaveLength(1);
  });

  it("closes when clicking outside or pressing Escape", () => {
    const state: FilterState = {};
    const set = vi.fn();
    const clear = vi.fn();

    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <FilterBar
          spec={spec}
          state={state}
          set={set}
          clear={clear}
          activeCount={0}
          primaryKeys={["q"]}
        />
      </div>
    );

    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    // Reopen and click outside
    fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when clicking the close (X) button", () => {
    const state: FilterState = {};
    const set = vi.fn();
    const clear = vi.fn();

    render(
      <FilterBar
        spec={spec}
        state={state}
        set={set}
        clear={clear}
        activeCount={0}
        primaryKeys={["q"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close filters" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("updates date range and toggle filter values correctly", () => {
    const state: FilterState = {};
    const set = vi.fn();
    const clear = vi.fn();

    render(
      <FilterBar
        spec={spec}
        state={state}
        set={set}
        clear={clear}
        activeCount={0}
        primaryKeys={["q"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));

    // Change date range "from"
    fireEvent.change(screen.getByLabelText("Issued from"), { target: { value: "2026-09-01" } });
    expect(set).toHaveBeenCalledWith({ issued: { from: "2026-09-01" } });

    // Toggle checkbox
    fireEvent.click(screen.getByLabelText("Has photo or location"));
    expect(set).toHaveBeenCalledWith({ evidence: true });
  });

  it("offers Reset filters button when extra filters are active", () => {
    const state: FilterState = { status: "done", evidence: true };
    const set = vi.fn();
    const clear = vi.fn();

    render(
      <FilterBar
        spec={spec}
        state={state}
        set={set}
        clear={clear}
        activeCount={2}
        primaryKeys={["q"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Add filter/ }));
    expect(screen.getByText("2 active")).toBeTruthy();

    const resetBtn = screen.getByRole("button", { name: "Reset filters" });
    expect(resetBtn).toBeTruthy();
    fireEvent.click(resetBtn);

    expect(set).toHaveBeenCalledWith({
      status: undefined,
      school: undefined,
      period: undefined,
      issued: undefined,
      evidence: undefined,
    });
  });
});
