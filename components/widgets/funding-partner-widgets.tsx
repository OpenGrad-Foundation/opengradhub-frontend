import StatCard from "./stat-card";

export default function FundingPartnerWidgets() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <StatCard label="Analytics" />
      <StatCard label="Announcements" />
    </div>
  );
}
