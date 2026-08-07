// Live-class attendance API — roster, manual marking, student-wise summary,
// per-student drill-down. Lives in its own module (rather than lib/api.ts) so
// the attendance surface stays self-contained.

import { API_BASE_URL, apiFetch, ApiError } from "./api";

export type AttendanceRosterRow = {
  student_id: string;
  name: string;
  email: string | null;
  school_name: string | null;
  status: "PRESENT" | "ABSENT";
  source: "AUTO" | "MANUAL" | null;
  joined_at: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
};

export type AttendanceSummary = {
  classes: { id: string; title: string; scheduled_at: string }[];
  students: {
    id: string; name: string; school_name: string | null;
    cells: ("PRESENT" | "ABSENT")[]; present_count: number; total: number; pct: number;
  }[];
  page: number; limit: number; total: number;
};

export type StudentAttendance = {
  student: { id: string; name: string; school_name: string | null };
  summary: { present: number; total: number; pct: number };
  classes: {
    class_id: string; title: string; scheduled_at: string;
    status: "PRESENT" | "ABSENT"; source: "AUTO" | "MANUAL" | null;
    joined_at: string | null; marked_by_name: string | null;
  }[];
};

export async function getLiveClassRoster(liveClassId: string): Promise<AttendanceRosterRow[]> {
  const r = await apiFetch(`${API_BASE_URL}/live-classes/${liveClassId}/roster`);
  if (!r.ok) throw new ApiError("Failed to fetch roster.", r.status);
  return (await r.json()) as AttendanceRosterRow[];
}

export async function putLiveClassAttendance(
  liveClassId: string,
  marks: { student_id: string; status: "PRESENT" | "ABSENT" }[],
): Promise<{ updated: number }> {
  const r = await apiFetch(`${API_BASE_URL}/live-classes/${liveClassId}/attendance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ marks }),
    cache: "no-store",
  });
  if (!r.ok) throw new ApiError("Failed to save attendance.", r.status);
  return (await r.json()) as { updated: number };
}

export async function getAttendanceSummary(params: {
  course_id?: string; batch_id?: string; from?: string; to?: string; page?: number; limit?: number;
}): Promise<AttendanceSummary> {
  const url = new URL(`${API_BASE_URL}/live-classes/attendance/summary`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const r = await apiFetch(url.toString());
  if (!r.ok) throw new ApiError("Failed to fetch attendance summary.", r.status);
  return (await r.json()) as AttendanceSummary;
}

export async function getStudentAttendance(studentId: string): Promise<StudentAttendance> {
  const r = await apiFetch(`${API_BASE_URL}/live-classes/attendance/students/${studentId}`);
  if (!r.ok) throw new ApiError("Failed to fetch student attendance.", r.status);
  return (await r.json()) as StudentAttendance;
}
