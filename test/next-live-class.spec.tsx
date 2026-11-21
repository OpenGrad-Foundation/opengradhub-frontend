import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getNextLiveClass } from "@/lib/api";

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/lib/queries/live-classes", () => ({ useNextLiveClass: () => query.current }));

import NextLiveClassHero from "@/app/dashboard/_components/NextLiveClassHero";

const liveNow = {
  id: "lc-1",
  title: "CUD-02 Physics",
  scheduled_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  duration_minutes: 60,
};

function renderHero(state: Record<string, unknown>) {
  query.current = { data: undefined, error: null, failureReason: null, isError: false, fetchStatus: "idle", refetch: vi.fn(), ...state };
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}><NextLiveClassHero studentId="s-1" /></QueryClientProvider>);
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("getNextLiveClass", () => {
  // The API answers `null` (no upcoming class) as a 200 with an EMPTY body.
  it("treats an empty 200 body as no class", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    await expect(getNextLiveClass("s-1")).resolves.toBeNull();
  });

  it("returns the class from a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(liveNow), { status: 200 })));
    await expect(getNextLiveClass("s-1")).resolves.toMatchObject({ id: "lc-1" });
  });

  it("still fails on a malformed body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{oops", { status: 200 })));
    await expect(getNextLiveClass("s-1")).rejects.toThrow();
  });
});

describe("NextLiveClassHero", () => {
  it("renders nothing when there is no upcoming class", () => {
    const { container } = renderHero({ data: null });
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while the first load is still retrying", () => {
    const { container } = renderHero({ failureReason: new Error("blip"), fetchStatus: "fetching" });
    expect(container.innerHTML).toBe("");
  });

  it("keeps the Join button when a refresh fails", () => {
    const err = new Error("blip");
    renderHero({ data: liveNow, failureReason: err, error: err, isError: true });
    expect(screen.getByRole("button", { name: /join now/i })).toHaveProperty("disabled", false);
    expect(screen.queryByText(/couldn't/i)).toBeNull();
  });

  it("shows a small link to Live Classes when loading finally fails", () => {
    const err = new Error("down");
    renderHero({ failureReason: err, error: err, isError: true });
    expect(screen.getByText(/couldn.t check for your next class/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /live classes/i }).getAttribute("href")).toBe("/dashboard/live-classes");
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
