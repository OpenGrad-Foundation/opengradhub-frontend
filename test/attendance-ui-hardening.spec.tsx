import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

/**
 * The second half of the UI review: the places a screen either destroyed
 * something irreversibly without asking, or reported a failure as a fact.
 */

const joinLiveClass = vi.fn();
const deleteLiveClass = vi.fn();
let classes: unknown[];
let liveClassesQuery: { data: unknown; isPending: boolean; error: Error | null; refetch: () => void };

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/live-classes",
}));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ data: { user: { id: "u1" } }, isLoading: false }) }));
vi.mock("@/hooks/use-permission", () => ({ usePermissions: () => ({ has: () => true, isLoading: false }) }));
vi.mock("@/lib/queries/live-classes", () => ({ useLiveClasses: () => liveClassesQuery }));
vi.mock("@/lib/queries/attendance", () => ({
  useClassRoster: () => ({ data: undefined, isPending: true, error: null }),
  useMarkClassAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/mutations/invalidation", async (orig) => ({
  ...(await orig<typeof import("@/lib/mutations/invalidation")>()),
  useInvalidate: () => vi.fn(),
}));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  joinLiveClass: (...a: unknown[]) => joinLiveClass(...a),
  deleteLiveClass: (...a: unknown[]) => deleteLiveClass(...a),
  getCourses: () => Promise.resolve([]),
}));
vi.mock("@/lib/queries/batches", () => ({ useBatches: () => ({ data: [], isError: false, refetch: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import LiveClassesPage from "@/app/dashboard/live-classes/page";

const SOON = new Date(Date.now() + 5 * 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  classes = [{
    id: "lc1", title: "Maths", description: null, scheduled_at: SOON, duration_minutes: 60,
    meeting_url: "https://meet.example/x", course_id: null, course_title: null,
    programme_type: null, batch_ids: null, attendance_mode: "ONLINE", attendance_status: null,
  }];
  liveClassesQuery = { data: classes, isPending: false, error: null, refetch: vi.fn() };
});

describe("joining must not mark a student present into a blocked window", () => {
  it("opens the tab inside the click, before awaiting the request", async () => {
    const order: string[] = [];
    const fakeTab = { closed: false, location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn(() => { order.push("open"); return fakeTab; }));
    joinLiveClass.mockImplementation(async () => {
      order.push("request");
      return { meeting_url: "https://meet.example/real" };
    });

    render(<LiveClassesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Join/ }));

    // window.open AFTER an await is outside the user-gesture window, so Android
    // blocks it — while the join has already been recorded as attendance.
    await waitFor(() => expect(order).toEqual(["open", "request"]));
    await waitFor(() => expect(fakeTab.location.href).toBe("https://meet.example/real"));
  });

  it("hands over the link when the browser blocked the window anyway", async () => {
    vi.stubGlobal("open", vi.fn(() => null));
    joinLiveClass.mockResolvedValue({ meeting_url: "https://meet.example/real" });

    render(<LiveClassesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Join/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/marked present/i);
    expect(alert.querySelector("a")?.getAttribute("href")).toBe("https://meet.example/real");
  });
});

describe("controls a thumb has to hit", () => {
  const MIN = 44;
  const files = [
    "app/dashboard/live-classes/page.tsx",
    "app/dashboard/live-classes/_components/ClassRoster.tsx",
    "app/dashboard/live-classes/new/page.tsx",
  ];

  it.each(files)("%s gives every interactive style a 44px floor", (f) => {
    const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
    // Style entries whose NAME says they are pressed: buttons and segments.
    // Static badges and chips are not touch targets and are exempt.
    const controls = src.match(/^\s{2}\w*(?:Btn|segment|input):\s+.*$/gm) ?? [];
    expect(controls.length, "no controls found — did the style block move?").toBeGreaterThan(0);
    for (const line of controls) {
      if (/segmentOn|filterOn/.test(line)) continue; // modifier, inherits the base
      expect(line, line.trim().slice(0, 60)).toContain(`minHeight: "${MIN}px"`);
    }
  });
});

describe("status colour is defined once, and passes AA", () => {
  it("no screen redefines the status palette locally", () => {
    for (const f of [
      "app/dashboard/live-classes/page.tsx",
      "app/dashboard/live-classes/_components/ClassRoster.tsx",
      "app/dashboard/attendance/_components/RecordsTab.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      // #0abe62 is 2.45:1 on white — it was the colour carrying "present".
      expect(src, f).not.toContain("#0abe62");
      expect(src, f).not.toContain("rgba(3,72,82,0.35)");
    }
  });
});

describe("form fields are labelled to the machine, not just to the eye", () => {
  it.each([
    "app/dashboard/live-classes/new/page.tsx",
    "app/dashboard/live-classes/[id]/edit/page.tsx",
  ])("%s uses a real label element", (f) => {
    const src = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
    const field = src.slice(src.indexOf("function Field("));
    expect(field.slice(0, 400)).toContain("<label");
    expect(src).toContain('role="alert"');
  });
});


describe("tabs answer the keyboard the way they claim to", () => {
  it("moves between tabs with the arrow keys and keeps one tab stop", async () => {
    const { Tabs } = await import("@/app/dashboard/_components/Tabs");
    render(
      <Tabs
        ariaLabel="Attendance tabs"
        tabs={[
          { key: "a", label: "Records", panel: <p>A</p> },
          { key: "b", label: "School confirmations", panel: <p>B</p> },
        ]}
      />,
    );

    const tabs = await screen.findAllByRole("tab");
    // Exactly one tab stop: arrows do the moving, Tab leaves for the panel.
    expect(tabs.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(nav.replace).toHaveBeenCalledWith(expect.stringContaining("tab=b"), { scroll: false });
  });
});

describe("the upcoming/past split follows the clock", () => {
  it("does not freeze the clock at mount", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/attendance/_components/SchoolConfirmationsTab.tsx"),
      "utf-8",
    );
    // A class that ends while the tab is open has to cross into Past.
    expect(src).toContain("setInterval");
    expect(src).not.toMatch(/const \[now\] = useState/);
  });
});
