import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom has no ResizeObserver; the sidebar's scroll-indicator effect needs it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// --- mocks --------------------------------------------------------------
let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockModules: { code: string }[] = [];
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ data: { modules: mockModules } }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as Record<string, string>)} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import Sidebar from "@/components/sidebar";

const ALL_LMS = [
  "courses",
  "bundles",
  "assessments",
  "test_bank",
  "assignments",
  "live_classes",
  "calendar",
  "resources",
].map((code) => ({ code }));

beforeEach(() => {
  mockPathname = "/dashboard";
  mockModules = [{ code: "dashboard" }, ...ALL_LMS, { code: "doubts" }, { code: "tracker" }];
  localStorage.clear();
});

describe("Sidebar LMS group", () => {
  it("renders the group header when at least one LMS module is granted", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /^lms$/i })).toBeTruthy();
  });

  it("nests LMS children under the group and keeps non-LMS modules flat", () => {
    render(<Sidebar />);
    // Group is open by default → Courses link visible.
    expect(screen.getByRole("link", { name: /courses/i })).toBeTruthy();
    // Non-LMS modules render as top-level links.
    expect(screen.getByRole("link", { name: /doubts/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /tracker/i })).toBeTruthy();
  });

  it("does not render the group header when no LMS module is granted", () => {
    mockModules = [{ code: "dashboard" }, { code: "tracker" }];
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /^lms$/i })).toBeNull();
  });

  it("auto-expands the group when the active path is an LMS child, even if stored closed", () => {
    localStorage.setItem("sidebar.lms.open", "false");
    mockPathname = "/dashboard/courses";
    render(<Sidebar />);
    // Group forced open by active child → Courses link visible.
    expect(screen.getByRole("link", { name: /courses/i })).toBeTruthy();
    const header = screen.getByRole("button", { name: /^lms$/i });
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });

  it("respects stored closed state when not on an LMS child", () => {
    localStorage.setItem("sidebar.lms.open", "false");
    mockPathname = "/dashboard/tracker"; // tracker is flat, not an LMS child
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /^lms$/i }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(screen.queryByRole("link", { name: /courses/i })).toBeNull();
  });

  it("toggling the header persists open state to localStorage", () => {
    mockPathname = "/dashboard"; // not an LMS child, so toggle governs visibility
    render(<Sidebar />);
    const header = screen.getByRole("button", { name: /^lms$/i });
    // Default open.
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("sidebar.lms.open")).toBe("false");
  });

  it("renders no group header in the collapsed rail but still shows LMS children", () => {
    render(<Sidebar collapsed />);
    expect(screen.queryByRole("button", { name: /^lms$/i })).toBeNull();
    // Children rendered flat as leaf links.
    expect(screen.getByRole("link", { name: /courses/i })).toBeTruthy();
  });
});

const ALL_ADMIN = ["user_management", "role_management", "schools", "batches"].map((code) => ({
  code,
}));

describe("Sidebar Management group", () => {
  beforeEach(() => {
    mockModules = [{ code: "dashboard" }, ...ALL_ADMIN, { code: "tracker" }];
  });

  it("renders the group header when at least one management module is granted", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /management/i })).toBeTruthy();
  });

  it("nests management children under the group and keeps non-grouped modules flat", () => {
    render(<Sidebar />);
    for (const name of [/user management/i, /role management/i, /schools/i, /batches/i]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: /tracker/i })).toBeTruthy();
  });

  it("does not render the group header when no management module is granted", () => {
    mockModules = [{ code: "dashboard" }, { code: "tracker" }];
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /management/i })).toBeNull();
  });

  it("auto-expands the group when the active path is a management child, even if stored closed", () => {
    localStorage.setItem("sidebar.management.open", "false");
    mockPathname = "/dashboard/schools";
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /schools/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /management/i }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("respects stored closed state when not on a management child", () => {
    localStorage.setItem("sidebar.management.open", "false");
    mockPathname = "/dashboard/tracker";
    render(<Sidebar />);
    expect(
      screen.getByRole("button", { name: /management/i }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByRole("link", { name: /schools/i })).toBeNull();
  });

  it("toggling the header persists open state under its own storage key", () => {
    render(<Sidebar />);
    const header = screen.getByRole("button", { name: /management/i });
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("sidebar.management.open")).toBe("false");
  });

  it("collapses independently of the LMS group", () => {
    mockModules = [{ code: "dashboard" }, ...ALL_LMS, ...ALL_ADMIN];
    localStorage.setItem("sidebar.management.open", "false");
    render(<Sidebar />);
    expect(
      screen.getByRole("button", { name: /^lms$/i }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /management/i }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.getByRole("link", { name: /courses/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /schools/i })).toBeNull();
  });

  it("renders no group header in the collapsed rail but still shows management children", () => {
    render(<Sidebar collapsed />);
    expect(screen.queryByRole("button", { name: /management/i })).toBeNull();
    expect(screen.getByRole("link", { name: /schools/i })).toBeTruthy();
  });
});
