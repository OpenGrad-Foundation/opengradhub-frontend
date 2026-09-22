"use client";

import { useState } from "react";
import {
  useProgrammeInsights,
  useAnalyticsFilterStates,
  useAnalyticsFilterDistricts,
  useAnalyticsFilterSchools,
  useAnalyticsFilterProgrammes,
} from "@/lib/queries/analytics";
import { KpiStrip } from "./KpiStrip";
import { TrendDistribution } from "./TrendDistribution";
import { NeedsAttention } from "./NeedsAttention";
import { ZONE_LOWER } from "@/lib/labels";
import { ScopeChip } from "./ScopeChip";
import { SearchableSelect } from "./SearchableSelect";
import SchoolDetail from "./SchoolDetail";
import ManagerDrill from "./ManagerDrill";

export default function ProgrammeInsights() {
  // Programme records are the same filter for every analytics viewer.
  const [programmeId, setProgrammeId] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [drilledSchoolId, setDrilledSchoolId] = useState<string | null>(null);
  const [drilledCourse, setDrilledCourse] = useState<{ id: string; title: string } | null>(null);
  const { data, isPending, error } = useProgrammeInsights({
    programmeId: programmeId || undefined,
    state:       state       || undefined,
    district:    district    || undefined,
    schoolId:    schoolId    || undefined,
  });
  const programmesQ = useAnalyticsFilterProgrammes();
  const statesQ    = useAnalyticsFilterStates(programmeId || undefined);
  const districtsQ = useAnalyticsFilterDistricts(state || undefined, programmeId || undefined);
  const schoolsQ   = useAnalyticsFilterSchools(state || undefined, district || undefined, programmeId || undefined);

  if (drilledSchoolId) {
    return (
      <SchoolDetail
        schoolId={drilledSchoolId}
        onBack={() => setDrilledSchoolId(null)}
      />
    );
  }
  if (drilledCourse) {
    return (
      <ManagerDrill
        courseId={drilledCourse.id}
        courseTitle={drilledCourse.title}
        onBack={() => setDrilledCourse(null)}
      />
    );
  }

  if (isPending) return <Spinner />;
  if (error)     return <Err msg={(error as Error).message} />;
  if (!data)     return null;

  const isPartner = data.scope.kind === "partner";
  const selectedProgramme = programmesQ.data?.find(p => p.id === programmeId);
  const noSeats = isPartner && (data.scope.programme_ids?.length ?? 0) === 0;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px",
          padding: "clamp(16px,4vw,24px)", marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "16px", flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <ScopeChip scope={selectedProgramme ? { ...data.scope, label: selectedProgramme.name } : data.scope} />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <SearchableSelect
                placeholder="All programmes"
                value={programmeId}
                disabled={programmesQ.isPending || !!programmesQ.error}
                onChange={(v) => {
                  setProgrammeId(v);
                  setState(""); setDistrict(""); setSchoolId("");
                }}
                options={(programmesQ.data ?? []).map(p => ({ value: p.id, label: p.name }))}
              />
              {programmesQ.error && <p role="alert" className="self-center text-sm" style={{ color: "#b83232" }}>Could not load programmes. <button type="button" className="underline" onClick={() => void programmesQ.refetch()}>Retry</button></p>}
              <SearchableSelect
                placeholder="All states"
                value={state}
                onChange={(v) => {
                  setState(v);
                  setDistrict("");
                  setSchoolId("");
                }}
                options={(statesQ.data ?? []).map((s) => ({ value: s, label: s }))}
              />
              <SearchableSelect
                placeholder={`All ${ZONE_LOWER}s`}
                value={district}
                onChange={(v) => {
                  setDistrict(v);
                  setSchoolId("");
                }}
                options={(districtsQ.data ?? []).map((d) => ({ value: d, label: d }))}
              />
              <SearchableSelect
                placeholder="All schools"
                value={schoolId}
                onChange={setSchoolId}
                options={(schoolsQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
          </div>
        </div>
      </div>

      {noSeats && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px",
          padding: "clamp(16px,4vw,24px)", marginBottom: "24px", textAlign: "center",
          color: "var(--color-text-muted)", fontSize: "14px",
        }}>
          You&rsquo;re not seated in any programme yet, so there is nothing to show here.
          Ask a programme manager to add you.
        </div>
      )}
      <KpiStrip kpis={data.kpis} />
      <TrendDistribution
        trend={data.trend}
        distribution={data.distribution}
        onBarClick={(entity, row) => {
          if (entity === "school")  setDrilledSchoolId(row.id);
          if (entity === "course")  setDrilledCourse({ id: row.id, title: row.name });
          // district: no-op for now
        }}
      />
      {data.needs_attention && <NeedsAttention data={data.needs_attention} />}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Loading insights…</p>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <div style={{ padding: "24px", color: "#b83232", fontSize: "14px" }}>Error: {msg}</div>;
}
