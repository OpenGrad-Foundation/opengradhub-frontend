import { afterEach, describe, expect, it, vi } from "vitest";
import { openMeetingTab } from "@/lib/meeting-tab";

function stubOpen(tab: unknown) {
  const open = vi.fn(() => tab);
  vi.stubGlobal("window", { open });
  return open;
}

describe("openMeetingTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens before the await without noopener, then navigates and severs opener", async () => {
    const tab = { closed: false, opener: {} as unknown, location: { href: "about:blank" }, close: vi.fn() };
    const open = stubOpen(tab);
    const p = openMeetingTab(async () => "https://meet.example/x");
    expect(open).toHaveBeenCalledWith("", "_blank"); // sync, inside the gesture
    expect(await p).toBe(true);
    expect(tab.location.href).toBe("https://meet.example/x");
    expect(tab.opener).toBeNull();
  });

  it("returns false when the popup was blocked", async () => {
    stubOpen(null);
    expect(await openMeetingTab(async () => "https://meet.example/x")).toBe(false);
  });

  it("closes the blank tab and rethrows when the join fails", async () => {
    const tab = { closed: false, opener: null, location: { href: "" }, close: vi.fn() };
    stubOpen(tab);
    await expect(openMeetingTab(async () => { throw new Error("nope"); })).rejects.toThrow("nope");
    expect(tab.close).toHaveBeenCalled();
  });
});
