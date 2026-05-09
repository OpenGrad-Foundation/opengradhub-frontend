import StatCard from "./stat-card";

export default function FellowWidgets() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Assigned Students" />
      <StatCard label="Analytics" />
      <StatCard label="Student Export" />
    </div>
  );
}
