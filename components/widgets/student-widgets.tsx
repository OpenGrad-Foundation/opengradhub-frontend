import StatCard from "./stat-card";

type StudentWidgetsProps = {
  programmeType?: string | null;
};

export default function StudentWidgets({ programmeType }: StudentWidgetsProps) {
  const cards = ["My Courses", "Doubts", "Announcements"];

  if (programmeType === "PG") {
    cards.splice(1, 0, "My Assessments");
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((label) => (
        <StatCard key={label} label={label} />
      ))}
    </div>
  );
}
