import StatCard from "./stat-card";

export default function ProgramManagerWidgets() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Active Courses" />
      <StatCard label="Assessments" />
      <StatCard label="Student Export" />
      <StatCard label="Announcements" />
    </div>
  );
}
