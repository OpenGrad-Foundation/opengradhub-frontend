import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getCoursesPage, getQuizzes, duplicateCourse } from "@/lib/api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    ok({ items: [], total: 0, page: 1, page_size: 6, total_pages: 1, has_next: false, has_prev: false }),
  );
});
afterEach(() => vi.unstubAllGlobals);

const urlOf = () => String(fetchMock.mock.calls[0][0]);
const initOf = () => fetchMock.mock.calls[0][1] as RequestInit | undefined;

describe("browse-to-duplicate query strings", () => {
  it("getCoursesPage sends scope=all only when asked", async () => {
    await getCoursesPage({ scope: "all", page: 1, pageSize: 6 });
    expect(urlOf()).toContain("scope=all");
    fetchMock.mockClear();
    await getCoursesPage({ page: 1, pageSize: 6 });
    expect(urlOf()).not.toContain("scope=");
  });

  it("getQuizzes sends scope=all only when asked", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await getQuizzes({ quiz_type: "GLOBAL_TEST", scope: "all" });
    expect(urlOf()).toContain("scope=all");
    fetchMock.mockClear();
    await getQuizzes({ quiz_type: "GLOBAL_TEST" });
    expect(urlOf()).not.toContain("scope=");
  });
});

describe("duplicateCourse body", () => {
  it("sends programme_id when given", async () => {
    fetchMock.mockResolvedValue(ok({ id: "copy" }));
    await duplicateCourse("c1", "p1");
    expect(urlOf()).toMatch(/\/courses\/c1\/duplicate$/);
    expect(JSON.parse(String(initOf()?.body))).toEqual({ programme_id: "p1" });
  });

  it("omits programme_id when nothing is chosen (server picks)", async () => {
    fetchMock.mockResolvedValue(ok({ id: "copy" }));
    await duplicateCourse("c1");
    expect(JSON.parse(String(initOf()?.body))).toEqual({});
  });
});
