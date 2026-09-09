import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const createSchool = vi.fn().mockResolvedValue({ id: "s1" });
const updateSchool = vi.fn().mockResolvedValue({ id: "s1" });

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createSchool: (...a: unknown[]) => createSchool(...a),
    updateSchool: (...a: unknown[]) => updateSchool(...a),
    setSchoolFellow: vi.fn().mockResolvedValue({}),
    getFellows: vi.fn().mockResolvedValue([]),
  };
});
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));

import { SchoolFormModal } from "@/app/dashboard/schools/SchoolFormModal";

function fill(labelRe: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(labelRe), { target: { value } });
}

beforeEach(() => {
  createSchool.mockClear();
  updateSchool.mockClear();
});

// Edit mode with state/district already set: the form's pre-existing "state is
// required" rule is not what these tests are about, and StateDistrictPicker is a
// custom widget that is awkward to drive from a unit test.
const existing = {
  id: "s1", name: "Govt HSS Coimbatore", state: "Tamil Nadu", district: "Coimbatore",
  code: "OG-SCH-001", fellow_id: null, fellow_name: null,
  latitude: null, longitude: null, verification_radius_m: null,
};

describe("SchoolFormModal — visit verification fields", () => {
  const open = () =>
    render(
      <SchoolFormModal mode="edit" school={existing} onClose={() => {}} onSaved={() => {}} />,
    );

  it("offers optional latitude, longitude and radius inputs", () => {
    open();
    expect(screen.getByLabelText(/latitude/i)).toBeTruthy();
    expect(screen.getByLabelText(/longitude/i)).toBeTruthy();
    expect(screen.getByLabelText(/radius/i)).toBeTruthy();
  });

  it("marks the coordinates as optional", () => {
    open();
    expect(screen.getByText(/visit verification location \(optional\)/i)).toBeTruthy();
  });

  it("saves a school with no coordinates at all", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateSchool).toHaveBeenCalled());
    const payload = updateSchool.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
  });

  it("sends the coordinates as numbers when provided", async () => {
    open();
    fill(/latitude/i, "11.0168");
    fill(/longitude/i, "76.9558");
    fill(/radius/i, "300");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateSchool).toHaveBeenCalled());
    const payload = updateSchool.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.latitude).toBeCloseTo(11.0168, 4);
    expect(payload.longitude).toBeCloseTo(76.9558, 4);
    expect(payload.verification_radius_m).toBe(300);
  });

  it("refuses to save only one half of the coordinate pair", async () => {
    open();
    fill(/latitude/i, "11.0168");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/both latitude and longitude/i)).toBeTruthy();
    expect(updateSchool).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range latitude before sending", async () => {
    open();
    fill(/latitude/i, "120");
    fill(/longitude/i, "76.9558");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/latitude must be a number/i)).toBeTruthy();
    expect(updateSchool).not.toHaveBeenCalled();
  });

  it("explains what the radius defaults to", () => {
    open();
    expect(screen.getByText(/default of 200 m/i)).toBeTruthy();
  });
});
