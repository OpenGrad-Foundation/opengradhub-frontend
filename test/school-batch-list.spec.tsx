import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SchoolBatchList } from "@/app/dashboard/schools/[id]/SchoolBatchList";

const student = (id: string, name: string) => ({
  id, name, roll_number: null, email: null, programme: null, status: "ACTIVE",
});

const batches = [
  {
    id: "b1",
    name: "CAT Morning",
    programme_type: "CAT",
    students: [student("s1", "Asha Rao"), student("s2", "Bala K")],
  },
  { id: "b2", name: "NEET Evening", programme_type: null, students: [] },
];

const currentUrl = "/dashboard/schools/sch-1";

describe("SchoolBatchList", () => {
  it("keeps batch labels without navigation when the batch view grant is absent", () => {
    render(<SchoolBatchList batches={batches} currentUrl={currentUrl} canOpen={false} />);
    expect(screen.getByText("CAT Morning")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("links each batch to its own batch page, carrying the school as ?from=", () => {
    render(<SchoolBatchList batches={batches} currentUrl={currentUrl} />);

    const first = screen.getByRole("link", { name: /CAT Morning/ });
    expect(first.getAttribute("href")).toBe(
      `/dashboard/batches/b1?from=${encodeURIComponent(currentUrl)}`,
    );
    expect(
      screen.getByRole("link", { name: /NEET Evening/ }).getAttribute("href"),
    ).toBe(`/dashboard/batches/b2?from=${encodeURIComponent(currentUrl)}`);
  });

  it("shows the programme and the member count on each row", () => {
    render(<SchoolBatchList batches={batches} currentUrl={currentUrl} />);

    expect(screen.getByText("CAT")).toBeTruthy();
    expect(screen.getByText("2 students")).toBeTruthy();
    expect(screen.getByText("0 students")).toBeTruthy();
  });

  it("is a flat list: no expand control and no inline roster", () => {
    const { container } = render(
      <SchoolBatchList batches={batches} currentUrl={currentUrl} />,
    );

    expect(container.querySelector("[aria-expanded]")).toBeNull();
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(screen.queryByText("Bala K")).toBeNull();
  });

  it("says so when the school hosts no batches", () => {
    render(<SchoolBatchList batches={[]} currentUrl={currentUrl} />);

    expect(screen.getByText(/no batches at this school yet/i)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
