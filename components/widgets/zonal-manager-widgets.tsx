import StatCard from "./stat-card";

export default function ZonalManagerWidgets() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Assigned Schools" />
      <StatCard label="Analytics" />
      <StatCard label="Announcements" />
    </div>
  );
}
