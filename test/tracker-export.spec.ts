import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: (...a: unknown[]) => apiFetch(...a) };
});

import { fetchTaskExport } from "@/lib/tracker-api";

const fileResponse = (disposition: string | null) =>
  ({
    ok: true, status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === "content-disposition" ? disposition : null) },
    blob: async () => new Blob(["a,b\r\n"], { type: "text/csv" }),
  }) as unknown as Response;

const urlOf = () => new URL(String(apiFetch.mock.calls[0][0]));

beforeEach(() => apiFetch.mockReset());

describe("fetchTaskExport", () => {
  it("asks for the records file only by default", async () => {
    apiFetch.mockResolvedValue(fileResponse('attachment; filename="visit-records.csv"'));
    const out = await fetchTaskExport("tpl1", {});
    expect(urlOf().pathname).toBe("/tracker/templates/tpl1/export");
    expect(urlOf().searchParams.get("history")).toBeNull();
    expect(out.filename).toBe("visit-records.csv");
  });

  it("asks for history and the owner drill when given them", async () => {
    apiFetch.mockResolvedValue(fileResponse('attachment; filename="visit-export.zip"'));
    await fetchTaskExport("tpl1", { history: true, ownerId: "f9" });
    expect(urlOf().searchParams.get("history")).toBe("1");
    expect(urlOf().searchParams.get("ownerId")).toBe("f9");
  });

  it("falls back to a task-named file when the server sends no disposition", async () => {
    apiFetch.mockResolvedValue(fileResponse(null));
    const out = await fetchTaskExport("tpl1", {});
    expect(out.filename).toBe("tracker-task-records.csv");
  });

  it("raises the server's message when the export is refused", async () => {
    apiFetch.mockResolvedValue({
      ok: false, status: 403,
      headers: { get: () => null },
      json: async () => ({ message: "staff member out of scope" }),
    } as unknown as Response);
    await expect(fetchTaskExport("tpl1", {})).rejects.toThrow(/out of scope/);
  });
});
