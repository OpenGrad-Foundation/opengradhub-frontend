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

describe("Sidebar LMS Tools group", () => {
  it("renders the group header when at least one LMS module is granted", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /lms tools/i })).toBeTruthy();
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
    mockModules = [{ code: "dashboard" }, { code: "doubts" }];
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /lms tools/i })).toBeNull();
  });
});
