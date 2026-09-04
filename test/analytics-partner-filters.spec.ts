import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getProgrammeInsights, getAnalyticsFilterProgrammes } from "@/lib/api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok({}));
});
afterEach(() => vi.unstubAllGlobals);

const urlOf = () => String(fetchMock.mock.calls[0][0]);

describe("programme insights query string", () => {
  it("sends programme_id when a partner picks a programme", async () => {
    await getProgrammeInsights({ programmeId: "11111111-1111-1111-1111-111111111111" });
    expect(urlOf()).toContain("programme_id=11111111-1111-1111-1111-111111111111");
  });

  it("never sends both axes at once", async () => {
    await getProgrammeInsights({ programmeId: "11111111-1111-1111-1111-111111111111" });
    expect(urlOf()).not.toContain("programme=");
  });

  it("still sends the kind filter for a global caller", async () => {
    await getProgrammeInsights({ programme: "CAT" });
    const url = urlOf();
    expect(url).toContain("programme=CAT");
    expect(url).not.toContain("programme_id=");
  });
});

describe("programme option list", () => {
  it("reads the analytics filter route, not /programmes", async () => {
    fetchMock.mockResolvedValue(ok([{ id: "p1", name: "CAT Kerala 2026" }]));
    const out = await getAnalyticsFilterProgrammes();
    expect(urlOf()).toContain("/analytics/filters/programmes");
    expect(urlOf()).not.toContain("/programmes?");
    expect(out).toEqual([{ id: "p1", name: "CAT Kerala 2026" }]);
  });
});
