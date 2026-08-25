import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `GET /live-classes` gained filters, and the one thing that must not change is
 * what a BARE call asks for. The School confirmations tab and the class edit
 * page both call `useLiveClasses()` with no arguments and need past and
 * archived classes; if the client started sending page defaults, both would
 * silently lose rows.
 */

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ getToken: async () => null }) }));

import { getLiveClasses } from "@/lib/api";
import { qk } from "@/lib/queries/keys";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const calledUrl = () => String(fetchMock.mock.calls[0][0]);

describe("getLiveClasses", () => {
  it("sends NO query string at all when called bare", async () => {
    await getLiveClasses();
    expect(calledUrl()).not.toContain("?");
  });

  it("sends the view and archived flags the page asks for", async () => {
    await getLiveClasses({ view: "past", include_archived: false });
    const url = calledUrl();
    expect(url).toContain("view=past");
    expect(url).toContain("include_archived=false");
  });

  it("sends an audience filter only when both halves are present", async () => {
    await getLiveClasses({ audience_type: "batch", audience_id: "b-1" });
    expect(calledUrl()).toContain("audience_type=batch");
    expect(calledUrl()).toContain("audience_id=b-1");

    fetchMock.mockClear();
    await getLiveClasses({ audience_type: "batch" });
    expect(calledUrl()).not.toContain("audience_type");
  });

  it("drops a blank search rather than sending an empty filter", async () => {
    await getLiveClasses({ q: "   " });
    expect(calledUrl()).not.toContain("q=");
  });
});

describe("live-class query keys", () => {
  it("keeps the bare list on its own key, separate from any filtered one", () => {
    expect(qk.liveClasses()).not.toEqual(qk.liveClasses({ view: "past" }));
  });

  it("gives the same filters the same key, so the cache is reused", () => {
    expect(qk.liveClasses({ view: "past" })).toEqual(qk.liveClasses({ view: "past" }));
  });
});
