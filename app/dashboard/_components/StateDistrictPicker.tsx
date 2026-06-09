"use client";

import type { CSSProperties } from "react";
import { STATES, districtsForState, districtDisabled, normState } from "@/lib/geo";

type Props = {
  state: string;
  district: string;
  onStateChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  /** Show the "All" (nationwide) state option. Pass false for schools. */
  includeAll?: boolean;
  /** Label of the empty state option. Filters use "All States" (= no filter). */
  blankStateLabel?: string;
  /** Per-call-site input styling so it blends into the surrounding form. */
  inputStyle?: CSSProperties;
  /** "row" = two side-by-side selects in a grid; "stacked" = each full-width. */
  layout?: "row" | "stacked";
  /** Optional ids for label association. */
  stateId?: string;
  districtId?: string;
};

const defaultInput: CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)",
  fontSize: "13px", outline: "none", boxSizing: "border-box",
};

export function StateDistrictPicker({
  state,
  district,
  onStateChange,
  onDistrictChange,
  includeAll = true,
  blankStateLabel = "Select…",
  inputStyle,
  layout = "row",
  stateId,
  districtId,
}: Props) {
  const style = { ...defaultInput, ...inputStyle };
  const options = STATES.filter((s) => includeAll || s.value !== "ALL");
  const districts = districtsForState(state);
  const districtOff = districtDisabled(state);

  // Normalize incoming (possibly label-form) state for option matching.
  // Fall back to the blank option if it isn't a known option, so the
  // controlled <select> never holds a value absent from its options.
  const normalized = normState(state);
  const stateValue = options.some((o) => o.value === normalized) ? normalized : "";

  function handleState(value: string) {
    onStateChange(value);
    // Cascade: a new state invalidates the prior district.
    onDistrictChange("");
  }

  const wrap: CSSProperties =
    layout === "row"
      ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }
      : { display: "grid", gridTemplateColumns: "1fr", gap: "12px" };

  return (
    <div style={wrap}>
      <select
        id={stateId}
        aria-label="State"
        value={stateValue}
        onChange={(e) => handleState(e.target.value)}
        style={style}
      >
        <option value="">{blankStateLabel}</option>
        {options.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        id={districtId}
        aria-label="District"
        value={district}
        onChange={(e) => onDistrictChange(e.target.value)}
        style={style}
        disabled={districtOff}
      >
        <option value="">
          {districtOff ? "—" : "Select district…"}
        </option>
        {districts.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </div>
  );
}
