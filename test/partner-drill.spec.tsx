import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartnerDrill } from "@/app/dashboard/shared-tracker/_components/partner-drill";
import { PARTNER_NO_PLACE, type PartnerBreakdownRow, type PartnerTaskRow } from "@/lib/tracker-api";

export let lastPartnerRecordsParams: (Record<string, unknown> & { schoolId?: string; studentId?: string }) | null = null;

const mockBreakdownData: Record<string, PartnerBreakdownRow[]> = {
  state: [
    { key: "KERALA", label: "KERALA", total: 10, done: 5, overdue: 0, blocked: 0 },
  ],
  zone: [
    { key: "Thrissur", label: "Thrissur", total: 10, done: 5, overdue: 0, blocked: 0 },
  ],
  school: [
    { key: "sch-1", label: "TEST SCHOOL", total: 5, done: 2, overdue: 0, blocked: 0 },
    { key: PARTNER_NO_PLACE, label: "No school on record", total: 2, done: 1, overdue: 0, blocked: 0 },
  ],
  student: [
    { key: "stu-1", label: "EPMTEST STUDENT 2", total: 1, done: 1, overdue: 0, blocked: 0 },
    { key: "stu-2", label: "OpengradTestStudent", total: 1, done: 0, overdue: 0, blocked: 0 },
  ],
};

vi.mock("@/lib/queries/tracker", () => ({
  usePartnerBreakdown: (
    _templateId: string | null,
    params: Record<string, unknown> & { level?: string },
  ) => {
    const level = params?.level ?? "";
    return {
      data: mockBreakdownData[level] ?? [],
      isLoading: false,
    };
  },
  usePartnerRecords: (
    _templateId: string | null,
    params: Record<string, unknown> & { schoolId?: string; studentId?: string },
  ) => {
    lastPartnerRecordsParams = params;
    return {
      data: {
        rows: [
          {
            id: "rec-1",
            school_name: params?.schoolId === PARTNER_NO_PLACE ? "No school on record" : "TEST SCHOOL",
            student_name: params?.studentId === "stu-1" ? "EPMTEST STUDENT 2" : "OpengradTestStudent",
            lifecycle: "done",
            status: "done",
            photo_count: 1,
            geo_count: 0,
          },
        ],
        total: 1,
        limit: 50,
        page: 1,
      },
      isLoading: false,
    };
  },
  usePartnerProofs: () => ({ data: [], isLoading: false }),
}));

describe("PartnerDrill seamless breadcrumb navigation", () => {
  const task: PartnerTaskRow = {
    template_id: "tpl-1",
    name: "Student Task",
    description: null,
    target_type: "student",
    programme_id: "prog-1",
    programme_name: "Programme 1",
    deadline: null,
    priority: "medium",
    total: 10,
    done: 5,
    blocked: 0,
    overdue: 0,
    not_started: 0,
    in_progress: 5,
    photo_count: 0,
    rolled_state: "in_progress",
  };

  it("drills to students, keeps breadcrumbs when viewing a student record, and allows going back to student list", () => {
    render(<PartnerDrill task={task} filters={{}} />);

    // 1. Initial level: State
    expect(screen.getByText("States")).toBeTruthy();
    expect(screen.getByRole("button", { name: /KERALA/ })).toBeTruthy();

    // Click KERALA
    fireEvent.click(screen.getByRole("button", { name: /KERALA/ }));

    // 2. Zone level
    expect(screen.getByText("Zones")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thrissur/ })).toBeTruthy();

    // Click Thrissur
    fireEvent.click(screen.getByRole("button", { name: /Thrissur/ }));

    // 3. School level
    expect(screen.getByText("Schools")).toBeTruthy();
    expect(screen.getByRole("button", { name: /TEST SCHOOL/ })).toBeTruthy();

    // Click TEST SCHOOL
    fireEvent.click(screen.getByRole("button", { name: /TEST SCHOOL/ }));

    // 4. Student list level
    expect(screen.getByText("Students")).toBeTruthy();
    expect(screen.getByRole("button", { name: /EPMTEST STUDENT 2/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /OpengradTestStudent/ })).toBeTruthy();

    // 5. Click EPMTEST STUDENT 2
    fireEvent.click(screen.getByRole("button", { name: /EPMTEST STUDENT 2/ }));

    // The student name is now the next breadcrumb level!
    expect(screen.getByText("Records")).toBeTruthy();
    // Breadcrumb has TEST SCHOOL and EPMTEST STUDENT 2
    const schoolCrumbs = screen.getAllByRole("button", { name: "TEST SCHOOL" });
    expect(schoolCrumbs.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "EPMTEST STUDENT 2" })).toBeTruthy();

    // Record table is displayed for this student
    expect(screen.getByRole("table")).toBeTruthy();

    // 6. Click "Back" button
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    // WE ARE BACK AT THE STUDENT LIST! Not reset to start!
    expect(screen.getByText("Students")).toBeTruthy();
    expect(screen.getByRole("button", { name: /EPMTEST STUDENT 2/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /OpengradTestStudent/ })).toBeTruthy();

    // 7. Click the second student
    fireEvent.click(screen.getByRole("button", { name: /OpengradTestStudent/ }));
    expect(screen.getByRole("button", { name: "OpengradTestStudent" })).toBeTruthy();

    // 8. Click "TEST SCHOOL" in breadcrumb to navigate back
    fireEvent.click(screen.getByRole("button", { name: "TEST SCHOOL" }));
    expect(screen.getByText("Students")).toBeTruthy();
    expect(screen.getByRole("button", { name: /EPMTEST STUDENT 2/ })).toBeTruthy();
  });

  it("drills into 'no school on record' with correct schoolId sentinel and without setting studentId", () => {
    lastPartnerRecordsParams = null;
    render(<PartnerDrill task={task} filters={{}} />);

    // 1. State
    fireEvent.click(screen.getByRole("button", { name: /KERALA/ }));

    // 2. Zone
    fireEvent.click(screen.getByRole("button", { name: /Thrissur/ }));

    // 3. School level shows "No school on record"
    const noSchoolBtn = screen.getByRole("button", { name: /no school on record/i });
    expect(noSchoolBtn).toBeTruthy();

    // Click "no school on record"
    fireEvent.click(noSchoolBtn);

    // Records view is shown directly
    expect(screen.getByText("Records")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();

    // Verify scope parameters sent to usePartnerRecords
    const recordedParams = lastPartnerRecordsParams as { schoolId?: string; studentId?: string } | null;
    expect(recordedParams).not.toBeNull();
    expect(recordedParams?.schoolId).toBe(PARTNER_NO_PLACE);
    expect(recordedParams?.studentId).toBeUndefined();

    // Click "Back" button returns to School list
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByText("Schools")).toBeTruthy();
    expect(screen.getByRole("button", { name: /TEST SCHOOL/ })).toBeTruthy();
  });
});
