import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getStudentRoster, getStudentsForBulk } from "@/lib/api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const page = {
  items: [{ id: "s1", name: "A", email: null, school_id: null, roll_number: null, programme_type: null, state: null, district: null, school_name: null }],
  total: 42,
  limit: 100,
  offset: 0,
  has_more: true,
  truncated: true,
  scope_limited: true,
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok(page));
});
afterEach(() => vi.unstubAllGlobals);

const urlOf = () => String(fetchMock.mock.calls[0][0]);
const initOf = () => fetchMock.mock.calls[0][1] as RequestInit | undefined;

describe("student roster client", () => {
  it("sends every filter to the server rather than filtering in the browser", async () => {
    await getStudentRoster({
      search: "deepasree",
      state: "TAMIL_NADU",
      district: "Chennai",
      school_id: "11111111-1111-1111-1111-111111111111",
      exclude_batch_id: "22222222-2222-2222-2222-222222222222",
      limit: 100,
      offset: 200,
    });
    const url = urlOf();
    expect(url).toContain("search=deepasree");
    expect(url).toContain("state=TAMIL_NADU");
    expect(url).toContain("district=Chennai");
    expect(url).toContain("school_id=11111111-1111-1111-1111-111111111111");
    expect(url).toContain("exclude_batch_id=22222222-2222-2222-2222-222222222222");
    expect(url).toContain("limit=100");
    expect(url).toContain("offset=200");
  });

  it("omits empty filters instead of sending blanks", async () => {
    await getStudentRoster({ search: "", state: undefined });
    const url = urlOf();
    expect(url).not.toContain("search=");
    expect(url).not.toContain("state=");
  });

  it("sends offset=0 explicitly, so a first page is never a cached later page", async () => {
    await getStudentRoster({ offset: 0, limit: 100 });
    expect(urlOf()).toContain("offset=0");
  });

  it("never caches — this is per-caller PII on a constant URL", async () => {
    await getStudentRoster({});
    expect(initOf()?.cache).toBe("no-store");
  });

  it("passes through has_more and scope_limited", async () => {
    const out = await getStudentRoster({});
    expect(out.has_more).toBe(true);
    expect(out.scope_limited).toBe(true);
    expect(out.total).toBe(42);
  });

  it("derives has_more when an older backend omits it", async () => {
    fetchMock.mockResolvedValue(ok({ items: page.items, total: 42, truncated: true }));
    const out = await getStudentRoster({});
    expect(out.has_more).toBe(true);
  });

  it("survives an old backend answering with a bare array", async () => {
    fetchMock.mockResolvedValue(ok(page.items));
    const out = await getStudentRoster({});
    expect(out.items).toHaveLength(1);
    expect(out.has_more).toBe(false);
    expect(out.scope_limited).toBe(false);
  });
});

describe("bulk roster client", () => {
  it("sends free text as school_name, not as school_id", async () => {
    // The server reads `school_id` as a UUID now; this caller has always sent a
    // typed school NAME, which would match nothing under the new parameter.
    await getStudentsForBulk({ school_id: "TN CAT 26 School" });
    const url = urlOf();
    expect(url).toContain("school_name=TN+CAT+26+School");
    expect(url).not.toContain("school_id=");
  });

  it("returns the page so the caller can report what it is NOT showing", async () => {
    const out = await getStudentsForBulk({ search: "x" });
    expect(out.total).toBe(42);
    expect(out.has_more).toBe(true);
  });
});
