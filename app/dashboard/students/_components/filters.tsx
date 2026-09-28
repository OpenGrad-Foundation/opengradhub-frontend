import type { StudentDirectoryFilters, StudentFacets } from "@/lib/api";
import { IN_CHARGE, ZONE } from "@/lib/labels";
import { inputStyle } from "@/app/dashboard/schools/styles";

export type DirectoryFilterValue = Pick<
  StudentDirectoryFilters,
  "q" | "programme_id" | "school_id" | "state" | "district" | "batch_id" | "in_charge_id"
>;

type FiltersProps = {
  facets: StudentFacets;
  value: DirectoryFilterValue;
  onChange: (value: DirectoryFilterValue) => void;
};

export function Filters({ facets, value, onChange }: FiltersProps) {
  const update = (key: keyof DirectoryFilterValue, next: string) => {
    onChange({ ...value, [key]: next || undefined });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
        <input
          type="search"
          value={value.q ?? ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Search students…"
          aria-label="Search students"
          style={{ ...inputStyle, paddingLeft: "36px" }}
        />
        <span aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(3,72,82,0.45)", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
      </div>

      <select
        value={value.programme_id ?? ""}
        onChange={(e) => update("programme_id", e.target.value)}
        aria-label="Filter by programme"
        style={{ ...inputStyle, width: "auto", minWidth: "170px" }}
      >
        <option value="">All programmes</option>
        {facets.programmes.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>

      <select
        value={value.school_id ?? ""}
        onChange={(e) => update("school_id", e.target.value)}
        aria-label="Filter by school"
        style={{ ...inputStyle, width: "auto", minWidth: "170px" }}
      >
        <option value="">All schools</option>
        {facets.schools.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>

      <input
        value={value.state ?? ""}
        onChange={(e) => update("state", e.target.value)}
        placeholder="Filter by state"
        aria-label="Filter by state"
        style={{ ...inputStyle, width: "auto", minWidth: "150px" }}
      />

      <input
        value={value.district ?? ""}
        onChange={(e) => update("district", e.target.value)}
        placeholder={`Filter by ${ZONE.toLowerCase()}`}
        aria-label={`Filter by ${ZONE.toLowerCase()}`}
        style={{ ...inputStyle, width: "auto", minWidth: "150px" }}
      />

      <select
        value={value.batch_id ?? ""}
        onChange={(e) => update("batch_id", e.target.value)}
        aria-label="Filter by batch"
        style={{ ...inputStyle, width: "auto", minWidth: "170px" }}
      >
        <option value="">All batches</option>
        {facets.batches.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>

      <select
        value={value.in_charge_id ?? ""}
        onChange={(e) => update("in_charge_id", e.target.value)}
        aria-label={`Filter by ${IN_CHARGE.toLowerCase()}`}
        style={{ ...inputStyle, width: "auto", minWidth: "190px" }}
      >
        <option value="">All {IN_CHARGE}s</option>
        {facets.inCharges.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </div>
  );
}
