import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getProgrammeInsights, getAnalyticsFilterProgrammes } from "@/lib/api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  // Re-stub every test, not just once at module load: afterEach below now
  // actually unstubs (that was the bug — `vi.unstubAllGlobals` was passed as
  // a reference, never called, so the stub silently leaked into other test
  // files), which means a fresh stub is needed each time this file's own
  // tests run past the first.
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok({}));
});
afterEach(() => vi.unstubAllGlobals());

const urlOf = () => String(fetchMock.mock.calls[0][0]);

describe("programme insights query string", () => {
  it("sends programme_id when a partner picks a programme", async () => {
    await getProgrammeInsights({ programmeId: "11111111-1111-1111-1111-111111111111" });
    expect(urlOf()).toContain("programme_id=11111111-1111-1111-1111-111111111111");
  });

  // The invariant "the client never sends both axes" is about what the
  // COMPONENT populates, not what this helper forwards — a call passing only
  // `programmeId` can never fail this assertion by construction. See
  // test/analytics-programme-insights-control.spec.tsx for the render test
  // that actually exercises ProgrammeInsights' two-state-variable control.

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
