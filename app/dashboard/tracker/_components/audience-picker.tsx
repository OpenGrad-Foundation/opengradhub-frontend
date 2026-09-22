"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTrackerAssignable } from "@/lib/queries/tracker";
import type { TrackerAssignable } from "@/lib/tracker-api";
import { ROLE_LABELS, ZONE } from "@/lib/labels";
import { SearchableSelect } from "@/app/dashboard/analytics/_components/SearchableSelect";

function prettyState(s: string | null): string {
  if (!s) return "";
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

const prettyRole = (r?: string | null) => (r ? ROLE_LABELS[r] ?? prettyState(r) : "");

/** "Who fills this in?" — the staff the caller may hand a task to (zonal managers and
 *  in-charges), with filters and a checkbox list + Select-all. The same list for every
 *  Task Target: a tick is a person, and the server turns that person into entries
 *  (their own row for a staff task, one row per school / student they reach otherwise).
 *  Reused by the builder and the "assign to more" flow. Parent owns the selected set.
 *
 *  Programme sits OUTSIDE the State → Zone cascade and ahead of it. It is the broadest
 *  real scope now that it reads the `programmes` entity rather than the legacy
 *  `users.programme` text, so it narrows the geographic options rather than being
 *  narrowed by them — picking a programme should shorten the state list, not leave it
 *  offering states the programme does not run in. */
export function AudiencePicker({
  canAuthor,
  selected,
  onChange,
}: {
  canAuthor: boolean;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const assignable = useTrackerAssignable("fellow", canAuthor);

  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");

  const uniq = (vals: (string | null | undefined)[]) => Array.from(new Set(vals.filter(Boolean) as string[])).sort();
  const all = useMemo(() => assignable.data ?? [], [assignable.data]);
  // A person can sit in several programmes (staff seats), so this is membership, not equality.
  const byProgramme = (t: TrackerAssignable) =>
    !programmeFilter || t.programmes.some((p) => p.id === programmeFilter);
  const byState = (t: TrackerAssignable) => !stateFilter || t.state === stateFilter;
  const byDistrict = (t: TrackerAssignable) => !districtFilter || t.district === districtFilter;
  const byRole = (t: TrackerAssignable) => !roleFilter || t.role === roleFilter;
  // A person "has" a school when a pick of them would cover it — their own schools and
  // their subordinates' (server-computed), so a ZM matches the schools under their in-charges.
  const bySchool = (t: TrackerAssignable) => !schoolFilter || (t.schools ?? []).some((s) => s.id === schoolFilter);

  // Programme's own options are computed over every person, unfiltered: it is the
  // outermost filter, so nothing downstream may remove a programme from its list.
  const programmeOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of all) for (const p of t.programmes) m.set(p.id, p.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  const inProgramme = useMemo(() => all.filter(byProgramme), [all, programmeFilter]);

  const stateOpts = useMemo(() => uniq(inProgramme.map((t) => t.state)), [inProgramme]);
  const districtOpts = useMemo(() => uniq(inProgramme.filter(byState).map((t) => t.district)), [inProgramme, stateFilter]);
  // Role filter only appears when the list actually mixes roles — i.e. a PM/Admin seeing ZMs
  // alongside in-charges. A ZM's list is in-charges only, so it stays hidden.
  const roleOpts = useMemo(() => uniq(all.map((t) => t.role)), [all]);
  // School options come from the people left after the geographic filters, so the
  // dropdown never offers a school that would match nobody in view.
  const schoolOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of inProgramme.filter((t) => byState(t) && byDistrict(t))) for (const s of t.schools ?? []) m.set(s.id, s.name);
    return Array.from(m, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [inProgramme, stateFilter, districtFilter]);
  const visible = useMemo(
    () => inProgramme.filter((t) => byState(t) && byDistrict(t) && byRole(t) && bySchool(t)),
    [inProgramme, stateFilter, districtFilter, roleFilter, schoolFilter],
  );
  const hiddenPicks = Array.from(selected).filter((id) => !visible.some((t) => t.id === id)).length;

  // Narrowing the programme can strip the downstream selections of their meaning —
  // a state the new programme does not run in would filter everything to nothing
  // while still reading as an active choice. Clear them, as State already does.
  const onProgramme = (v: string) => { setProgrammeFilter(v); setStateFilter(""); setDistrictFilter(""); setSchoolFilter(""); };
  const onState = (v: string) => { setStateFilter(v); setDistrictFilter(""); setSchoolFilter(""); };
  const onDistrict = (v: string) => { setDistrictFilter(v); setSchoolFilter(""); };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const filterClass = "h-9 rounded-lg border border-[var(--color-border-strong)] bg-white px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100";

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {programmeOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">Programme
            <select value={programmeFilter} onChange={(e) => onProgramme(e.target.value)} className={filterClass}>
              <option value="">All programmes</option>
              {programmeOpts.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
          </label>
        )}
        {roleOpts.length > 1 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">Role
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterClass}>
              <option value="">All roles</option>
              {roleOpts.map((r) => <option key={r} value={r}>{prettyRole(r)}</option>)}
            </select>
          </label>
        )}
        {stateOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">State
            <select value={stateFilter} onChange={(e) => onState(e.target.value)} className={filterClass}>
              <option value="">All states</option>
              {stateOpts.map((s) => <option key={s} value={s}>{prettyState(s)}</option>)}
            </select>
          </label>
        )}
        {districtOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">{ZONE}
            <select value={districtFilter} onChange={(e) => onDistrict(e.target.value)} className={filterClass}>
              <option value="">All districts</option>
              {districtOpts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        {schoolOpts.length > 0 && (
          <div className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">School
            <SearchableSelect value={schoolFilter} onChange={setSchoolFilter} options={schoolOpts} placeholder="All schools" />
          </div>
        )}
      </div>

      {assignable.isLoading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--teal)]" aria-hidden="true" /></div>
      ) : visible.length === 0 ? (
        <p className="py-4 text-sm text-[var(--color-text-muted)]">No staff in your scope for this filter.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onChange(new Set([...selected, ...visible.map((t) => t.id)]))} className="rounded-lg border border-teal-300 bg-[var(--color-success-surface)] px-2.5 py-1 text-xs font-medium text-[var(--teal)] hover:bg-teal-100">
              Select all {visible.length}
            </button>
            {/* One-click "everyone in this role" — the common case is "all ZMs" or "all
                in-charges", which the Role filter + Select all needs three clicks for. Adds to
                the selection, ignores the other filters on purpose. */}
            {roleOpts.length > 1 && roleOpts.map((r) => {
              const ids = all.filter((t) => t.role === r).map((t) => t.id);
              const label = prettyRole(r);
              return (
                <button key={r} type="button" onClick={() => onChange(new Set([...selected, ...ids]))}
                  className="rounded-lg border border-[var(--color-border-strong)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[#eef5f3]">
                  All {label.toLowerCase().endsWith("s") ? label : `${label}s`} ({ids.length})
                </button>
              );
            })}
          </div>
          <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
            {visible.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#eef5f3]">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="text-[var(--color-text)]">{t.name}</span>
                {roleOpts.length > 1 && t.role && (
                  <span className="rounded bg-[#eef5f3] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{prettyRole(t.role)}</span>
                )}
                {t.state && <span className="text-xs text-[var(--color-text-muted)]">{prettyState(t.state)}</span>}
              </label>
            ))}
          </div>
        </>
      )}
      {/* Clear lives outside the list so a filter that empties the view cannot strand
          picks the author can no longer see. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span>
          {selected.size} selected.
          {hiddenPicks > 0 && ` ${hiddenPicks} hidden by the filters above.`}
        </span>
        {selected.size > 0 && (
          <button type="button" onClick={() => onChange(new Set())} className="font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Clear</button>
        )}
      </div>
    </div>
  );
}
