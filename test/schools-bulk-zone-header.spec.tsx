import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({ grants: [] as string[] }));
const bulkUploadSchools = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  bulkUploadSchools: (...a: unknown[]) => bulkUploadSchools(...a),
  getProgrammes: vi.fn().mockResolvedValue([{ id: "p1", name: "UG Kerala", is_member: true, status: "ACTIVE" }]),
  getSchoolTemplateUrl: () => "/schools/template",
}));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));
vi.mock("@/hooks/use-permission", () => ({
  usePermissions: () => ({ has: (code: string) => state.grants.includes(code) }),
}));

import { SchoolBulkUploadPanel } from "@/app/dashboard/schools/BulkUploadPanel";

function upload(csv: string) {
  const { container } = render(<SchoolBulkUploadPanel onClose={() => {}} onDone={() => {}} />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([csv], "schools.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => { vi.clearAllMocks(); state.grants = []; });
afterEach(cleanup);

describe("schools bulk upload — geo column spelling", () => {
  it("labels the geo column Zone, not District", async () => {
    upload("name,district,state\nGHSS Nilambur,Malappuram,KERALA\n");
    await waitFor(() => expect(screen.getByText("Zone")).toBeTruthy());
    expect(screen.queryByText("District")).toBeNull();
  });

  it("still reads a template that spells the column 'district'", async () => {
    upload("name,district,state\nGHSS Nilambur,Malappuram,KERALA\n");
    await waitFor(() => expect(screen.getByDisplayValue("Malappuram")).toBeTruthy());
    expect(screen.getByText("✓ 1 ready")).toBeTruthy();
  });

  it("reads a CSV that spells the column 'zone' the way the UI does", async () => {
    upload("name,zone,state\nGHSS Nilambur,Malappuram,KERALA\n");
    await waitFor(() => expect(screen.getByDisplayValue("Malappuram")).toBeTruthy());
    expect(screen.getByText("✓ 1 ready")).toBeTruthy();
  });

  it("flags the row when neither spelling carries a value", async () => {
    upload("name,zone,state\nGHSS Nilambur,,KERALA\n");
    await waitFor(() => expect(screen.getByText("✗ 1 with errors")).toBeTruthy());
  });
});

describe("schools bulk upload — programme attachment", () => {
  it("hides the programme picker without programmes.manage", async () => {
    upload("name,district,state\nGHSS Nilambur,Malappuram,KERALA\n");
    await waitFor(() => expect(screen.getByText("Zone")).toBeTruthy());
    expect(screen.queryByLabelText(/Attach to programme/)).toBeNull();
  });

  it("sends the chosen programme with the upload", async () => {
    state.grants = ["programmes.manage"];
    bulkUploadSchools.mockResolvedValue({ created: 1, skipped: 0, errors: [], corrections: [], skippedRows: [] });
    upload("name,district,state\nGHSS Nilambur,Malappuram,KERALA\n");
    const select = await screen.findByLabelText(/Attach to programme/);
    await waitFor(() => expect(screen.getByText("UG Kerala")).toBeTruthy());
    fireEvent.change(select, { target: { value: "p1" } });
    fireEvent.click(await screen.findByText(/Import All/));
    await waitFor(() => expect(bulkUploadSchools).toHaveBeenCalled());
    expect(bulkUploadSchools.mock.calls[0][1]).toBe("p1");
  });
});
