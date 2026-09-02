import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  bulkUploadSchools: vi.fn(),
  getSchoolTemplateUrl: () => "/schools/template",
}));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));

import { SchoolBulkUploadPanel } from "@/app/dashboard/schools/BulkUploadPanel";

function upload(csv: string) {
  const { container } = render(<SchoolBulkUploadPanel onClose={() => {}} onDone={() => {}} />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([csv], "schools.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => vi.clearAllMocks());
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
