import StatCard from "./stat-card";

export default function SuperAdminWidgets() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total Users" />
      <StatCard label="Active Courses" />
      <StatCard label="Open Doubts" />
      <StatCard label="Announcements" />
    </div>
  );
}
