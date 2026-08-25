import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The builder pulls in a lot of tracker plumbing; stub every hook it touches so the
// test is about the "Proof of visit" section and nothing else.
vi.mock("@/lib/queries/tracker", () => ({
  useProfilePaths: () => ({ data: { paths: [] } }),
  useTrackerAssignable: () => ({ data: [], isLoading: false }),
  useTrackerTemplates: () => ({ data: [], isLoading: false }),
  useCreateTrackerTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/queries/batches", () => ({ useBatches: () => ({ data: [] }) }));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));

import { TrackerBuilder } from "@/app/dashboard/tracker/_components/tracker-builder";

const setup = () => render(<TrackerBuilder canAuthor />);

const geoToggle = () =>
  screen.queryByLabelText(/verify school visit using photo location metadata/i);

function chooseTarget(label: RegExp) {
  const select = screen.getByLabelText(/who does this task/i) as HTMLSelectElement;
  const option = [...select.options].find((o) => label.test(o.textContent ?? ""));
  if (!option) throw new Error(`no target option matching ${label}`);
  fireEvent.change(select, { target: { value: option.value } });
}

beforeEach(() => vi.clearAllMocks());

describe("authoring — school visit verification toggle", () => {
  it("offers the toggle for a school task", () => {
    setup();
    chooseTarget(/school/i);
    expect(geoToggle()).not.toBeNull();
  });

  it("offers the toggle for a student task", () => {
    setup();
    chooseTarget(/student/i);
    expect(geoToggle()).not.toBeNull();
  });

  it("hides the toggle for a staff task, which has no single school", () => {
    setup();
    chooseTarget(/fellow/i);
    expect(geoToggle()).toBeNull();
  });

  it("explains that one photo covers every entry for the school", () => {
    setup();
    chooseTarget(/school/i);
    expect(screen.getByText(/one photo .* covers (all|every)/i)).toBeTruthy();
  });

  it("keeps per-entry photo proof as a separate requirement", () => {
    setup();
    chooseTarget(/school/i);
    // Shared geo evidence does not satisfy the per-record photo requirement; both exist.
    expect(screen.getByLabelText(/require a photo/i)).toBeTruthy();
    expect(geoToggle()).not.toBeNull();
  });

  it("no longer offers the legacy live location capture", () => {
    setup();
    chooseTarget(/school/i);
    expect(screen.queryByLabelText(/require capturing location/i)).toBeNull();
  });
});
