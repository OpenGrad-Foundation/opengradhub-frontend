"use client";

import { useEffect, useState } from "react";
import { getFellowAnalytics, type FellowSchoolCard } from "@/lib/api";
import SchoolDetail from "./SchoolDetail";

const BRAND = {
  dark: "#034852",
  teal: "#006d6c",
  mid: "#209379",
  green: "#0abe62",
  light: "#a6db74",
  yellow: "#ffde00",
};

type Props = { callerId: string; callerRole: string };

export default function FellowAnalytics({ callerId, callerRole }: Props) {
  const [schools, setSchools] = useState<FellowSchoolCard[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getFellowAnalytics(callerId, callerRole)
      .then(setSchools)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [callerId, callerRole]);

  if (selectedSchoolId) {
    return (
      <SchoolDetail
        callerId={callerId}
        callerRole={callerRole}
        schoolId={selectedSchoolId}
        onBack={() => setSelectedSchoolId(null)}
      />
    );
  }

  if (loading) return <Spinner />;
  if (error) return <Err msg={error} />;

  return (
    <div>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.28em",
          color: BRAND.mid,
          marginBottom: "20px",
        }}
      >
        My Schools
      </p>

      {schools.length === 0 ? (
        <div
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: "20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            padding: "48px 36px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>
            No schools assigned yet.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {schools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              onClick={() => setSelectedSchoolId(school.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchoolCard({
  school,
  onClick,
}: {
  school: FellowSchoolCard;
  onClick: () => void;
}) {
  const isActive = school.badge === "ACTIVE";
  const completionColor =
    school.avg_completion >= 80
      ? BRAND.green
      : school.avg_completion >= 50
        ? BRAND.mid
        : BRAND.yellow;

  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.4)",
        borderRadius: "20px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        padding: "22px 24px",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        borderTop: `4px solid ${isActive ? BRAND.green : BRAND.yellow}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.07)";
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          padding: "3px 10px",
          borderRadius: "20px",
          background: isActive ? "rgba(10,190,98,0.12)" : "rgba(255,222,0,0.25)",
          color: isActive ? BRAND.green : "#a08600",
          marginBottom: "12px",
        }}
      >
        {isActive ? "Active" : "Needs Attention"}
      </div>

      {/* School name */}
      <p
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "16px",
          fontWeight: 700,
          color: BRAND.dark,
          margin: "0 0 4px",
          lineHeight: 1.3,
        }}
      >
        {school.name}
      </p>

      {school.district && (
        <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", margin: "0 0 16px" }}>
          {school.district}
          {school.state ? `, ${school.state}` : ""}
        </p>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: "20px" }}>
        <div>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(3,72,82,0.45)",
              marginBottom: "2px",
            }}
          >
            Students
          </p>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: BRAND.dark,
              fontFamily: "var(--font-heading)",
              margin: 0,
            }}
          >
            {school.enrolled_students}
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(3,72,82,0.45)",
              marginBottom: "2px",
            }}
          >
            Avg Completion
          </p>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: completionColor,
              fontFamily: "var(--font-heading)",
              margin: 0,
            }}
          >
            {school.avg_completion}%
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: "14px",
          height: "5px",
          background: "rgba(3,72,82,0.08)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(school.avg_completion, 100)}%`,
            height: "100%",
            background: completionColor,
            borderRadius: "3px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        minHeight: "200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading schools…</p>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "24px", color: "#c0392b", fontSize: "14px" }}>Error: {msg}</div>
  );
}
