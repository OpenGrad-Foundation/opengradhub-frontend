import type { StudentDirectoryFilters, StudentFacets } from "@/lib/api";
import { IN_CHARGE, ZONE } from "@/lib/labels";
import { Search } from "lucide-react";
import catalogue from "@/app/dashboard/_components/catalogue.module.css";
import styles from "../students.module.css";

export type DirectoryFilterValue = Pick<
  StudentDirectoryFilters,
  "q" | "programme_id" | "school_id" | "state" | "district" | "batch_id" | "in_charge_id"
>;

type FiltersProps = {
  facets: StudentFacets;
  value: DirectoryFilterValue;
  onChange: (value: DirectoryFilterValue) => void;
};

type Option = { id: string; name: string };

export function Filters({ facets, value, onChange }: FiltersProps) {
  const update = (key: keyof DirectoryFilterValue, next: string) => {
    onChange({ ...value, [key]: next || undefined });
  };

  const select = (key: keyof DirectoryFilterValue, label: string, ariaLabel: string, all: string, options: Option[]) => (
    <label className={catalogue.field}>
      {label}
      <select
        className={catalogue.control}
        value={value[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
        aria-label={ariaLabel}
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </label>
  );

  const text = (key: keyof DirectoryFilterValue, label: string, ariaLabel: string) => (
    <label className={catalogue.field}>
      {label}
      <input
        className={catalogue.control}
        value={value[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
        placeholder={`Any ${label.toLowerCase()}`}
        aria-label={ariaLabel}
      />
    </label>
  );

  return (
    <>
      <div className={catalogue.toolbar}>
        <label className={catalogue.search}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={value.q ?? ""}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Search students…"
            aria-label="Search students"
          />
        </label>
      </div>

      <div className={`${catalogue.filters} ${styles.filters}`}>
        {select("programme_id", "Programme", "Filter by programme", "All programmes", facets.programmes)}
        {select("school_id", "School", "Filter by school", "All schools", facets.schools)}
        {select("batch_id", "Batch", "Filter by batch", "All batches", facets.batches)}
        {select("in_charge_id", IN_CHARGE, `Filter by ${IN_CHARGE.toLowerCase()}`, `All ${IN_CHARGE}s`, facets.inCharges)}
        {text("state", "State", "Filter by state")}
        {text("district", ZONE, `Filter by ${ZONE.toLowerCase()}`)}
      </div>
    </>
  );
}
