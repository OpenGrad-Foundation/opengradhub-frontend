import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReportBugButton from "@/app/dashboard/_components/ReportBugButton";

const form = {
  appendToDom: vi.fn(),
  open: vi.fn(),
};
const createForm = vi.fn();
const getFeedback = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  getFeedback: () => getFeedback(),
}));

describe("ReportBugButton", () => {
  beforeEach(() => {
    form.appendToDom.mockClear();
    form.open.mockClear();
    createForm.mockReset().mockResolvedValue(form);
    getFeedback.mockReset().mockReturnValue({ createForm });
  });

  it("renders nothing when the feedback integration is absent", () => {
    getFeedback.mockReturnValue(undefined);
    const { container } = render(<ReportBugButton />);
    expect(container.firstChild).toBeNull();
  });

  it("opens the feedback form on click", async () => {
    render(<ReportBugButton />);
    fireEvent.click(screen.getByRole("button", { name: /report a bug/i }));
    await waitFor(() => expect(form.open).toHaveBeenCalledTimes(1));
    expect(createForm).toHaveBeenCalledTimes(1);
    expect(form.appendToDom).toHaveBeenCalledTimes(1);
  });

  it("reuses the same form on a second click", async () => {
    render(<ReportBugButton />);
    const btn = screen.getByRole("button", { name: /report a bug/i });
    fireEvent.click(btn);
    await waitFor(() => expect(form.open).toHaveBeenCalledTimes(1));
    fireEvent.click(btn);
    await waitFor(() => expect(form.open).toHaveBeenCalledTimes(2));
    expect(createForm).toHaveBeenCalledTimes(1);
    expect(form.appendToDom).toHaveBeenCalledTimes(1);
  });

  it("logs and survives a createForm failure", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createForm.mockRejectedValue(new Error("boom"));
    render(<ReportBugButton />);
    fireEvent.click(screen.getByRole("button", { name: /report a bug/i }));
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
    expect(form.open).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
