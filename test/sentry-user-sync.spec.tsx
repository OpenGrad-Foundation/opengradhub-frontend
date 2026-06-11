import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SentryUserSync from "@/components/sentry-user-sync";

const setUser = vi.fn();
const setTag = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  setUser: (...args: unknown[]) => setUser(...args),
  setTag: (...args: unknown[]) => setTag(...args),
}));

const useCurrentUser = vi.fn();
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => useCurrentUser(),
}));

describe("SentryUserSync", () => {
  beforeEach(() => {
    setUser.mockClear();
    setTag.mockClear();
  });

  it("sets Sentry user and role tag when a user is loaded", () => {
    useCurrentUser.mockReturnValue({
      data: {
        user: { id: "u1", fullName: "Asha Rao", email: "asha@example.com" },
        role: { code: "STUDENT", name: "Student" },
      },
    });
    render(<SentryUserSync />);
    expect(setUser).toHaveBeenCalledWith({
      id: "u1",
      email: "asha@example.com",
      username: "Asha Rao",
    });
    expect(setTag).toHaveBeenCalledWith("role", "STUDENT");
  });

  it("omits email when null", () => {
    useCurrentUser.mockReturnValue({
      data: {
        user: { id: "u2", fullName: "No Mail", email: null },
        role: { code: "FELLOW", name: "Fellow" },
      },
    });
    render(<SentryUserSync />);
    expect(setUser).toHaveBeenCalledWith({
      id: "u2",
      email: undefined,
      username: "No Mail",
    });
  });

  it("clears the Sentry user when no user data", () => {
    useCurrentUser.mockReturnValue({ data: undefined });
    render(<SentryUserSync />);
    expect(setUser).toHaveBeenCalledWith(null);
    expect(setTag).not.toHaveBeenCalled();
  });

  it("clears the Sentry user when the user signs out (data change)", () => {
    useCurrentUser.mockReturnValue({
      data: {
        user: { id: "u1", fullName: "Asha Rao", email: "asha@example.com" },
        role: { code: "STUDENT", name: "Student" },
      },
    });
    const { rerender } = render(<SentryUserSync />);
    expect(setUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
    );

    useCurrentUser.mockReturnValue({ data: undefined });
    rerender(<SentryUserSync />);
    expect(setUser).toHaveBeenLastCalledWith(null);
  });

  it("renders nothing", () => {
    useCurrentUser.mockReturnValue({ data: undefined });
    const { container } = render(<SentryUserSync />);
    expect(container.firstChild).toBeNull();
  });
});
