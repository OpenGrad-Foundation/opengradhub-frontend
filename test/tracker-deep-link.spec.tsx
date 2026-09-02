import { describe, it, expect } from "vitest";
import { getBackHref, withFrom } from "@/lib/nav";

/**
 * The student-profile -> tracker round trip. The link is built on the profile with
 * `withFrom`, and the tracker's back control resolves it with `getBackHref`, so the
 * two halves have to agree on the encoding.
 */
describe("task deep link round trip", () => {
  const profile = "/dashboard/students/ba000001-0000-0000-0000-000000000001";
  const link = (from: string) => withFrom("/dashboard/tracker?task=tpl-1", from);

  it("returns to the profile the link was built from", () => {
    const href = link(profile);
    const from = new URLSearchParams(href.split("?")[1]).get("from");
    expect(getBackHref(from, "/dashboard/tracker")).toBe(profile);
  });

  it("keeps the task param alongside the origin", () => {
    const params = new URLSearchParams(link(profile).split("?")[1]);
    expect(params.get("task")).toBe("tpl-1");
  });

  it("falls back rather than following an external origin", () => {
    expect(getBackHref("https://evil.example.com", "/dashboard/tracker")).toBe("/dashboard/tracker");
    expect(getBackHref("//evil.example.com", "/dashboard/tracker")).toBe("/dashboard/tracker");
    expect(getBackHref("/etc/passwd", "/dashboard/tracker")).toBe("/dashboard/tracker");
  });

  it("falls back when there is no origin at all", () => {
    expect(getBackHref(null, "/dashboard/tracker")).toBe("/dashboard/tracker");
  });
});
