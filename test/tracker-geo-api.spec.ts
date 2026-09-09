import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: (...a: unknown[]) => apiFetch(...a) };
});

import { getRecordGeoVerification } from "@/lib/tracker-api";

const response = (status: number, body: string) =>
  ({ ok: status < 400, status, text: async () => body, json: async () => JSON.parse(body) }) as Response;

beforeEach(() => apiFetch.mockReset());

describe("getRecordGeoVerification", () => {
  it("returns null when the row has no verification", async () => {
    // The backend returns `null`, which Nest serialises as a 200 with an EMPTY body.
    // Returning undefined from here makes React Query throw
    // "Query data cannot be undefined", so the absence must be an explicit null.
    apiFetch.mockResolvedValue(response(200, ""));
    await expect(getRecordGeoVerification("r1")).resolves.toBeNull();
  });

  it("still returns the verification when there is one", async () => {
    apiFetch.mockResolvedValue(response(200, JSON.stringify({ id: "v1", school_id: "s1" })));
    await expect(getRecordGeoVerification("r1")).resolves.toMatchObject({ id: "v1" });
  });
});
