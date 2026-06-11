import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MathTextEditor } from "@/app/dashboard/_components/MathTextEditor";

afterEach(cleanup);

describe("MathTextEditor", () => {
  it("renders the value in a textarea and fires onChange on typing", () => {
    const onChange = vi.fn();
    render(<MathTextEditor value="hello" onChange={onChange} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.value).toBe("hello");
    fireEvent.change(ta, { target: { value: "hello world" } });
    expect(onChange).toHaveBeenCalledWith("hello world");
  });

  it("shows a rendered preview only when the value contains math", () => {
    const { rerender } = render(<MathTextEditor value="plain text" onChange={() => {}} />);
    expect(screen.queryByTestId("math-preview")).toBeNull();
    rerender(<MathTextEditor value="Solve $4x$ now" onChange={() => {}} />);
    expect(screen.queryByTestId("math-preview")).not.toBeNull();
    expect(screen.getAllByTitle("Click to edit equation")).toHaveLength(1);
  });

  it("shows an Equation button and a hint when provided", () => {
    render(<MathTextEditor value="" onChange={() => {}} hint="display only" />);
    expect(screen.getByRole("button", { name: /equation/i })).not.toBeNull();
    expect(screen.getByText("display only")).not.toBeNull();
  });
});
