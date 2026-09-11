"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useTrackerTeam, useTrackerFellowTasks, useTrackerFellows } from "@/lib/queries/tracker";
import type { TrackerTeamMember } from "@/lib/tracker-api";
import { roleLabel } from "@/lib/labels";
import { TaskListView } from "./my-tasks";
import { NudgeButton } from "./nudge-button";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";

type Person = { id: string; name: string };

function Loading() {
  return <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>;
}

/** Tasks tab › By team. One drill down the reporting line: every level lists a
 *  manager's direct reports (any staff role, badge on each row). A row with reports
 *  opens as the next level — their own tasks plus their reports — and a row without
 *  goes straight to that person's task list. The root is whatever the server says the
 *  caller's team is: direct reports for a manager, the tops of every tree for an admin. */
export function TeamView({ onOpen, onAssign, initialOwnerId }: {
  onOpen: (templateId: string, ownerId: string, ownerName?: string) => void;
  /** Jump to the task builder with this person pre-selected as the audience. */
  onAssign?: (person: Person) => void;
  /** `?owner=` deep link (e.g. from a staff profile): open this person's tasks once resolved. */
  initialOwnerId?: string | null;
}) {
  const [path, setPath] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const canAuthor = usePermissions().has(PERM.tracker.author);

  const current = path[path.length - 1] ?? null;
  const level = useTrackerTeam(current?.id ?? null, !person);
  const ownTasks = useTrackerFellowTasks(person?.id ?? current?.id);

  // Deep link: the flat in-scope staff list resolves the id to a name, then the leaf
  // opens directly without walking the tree. Seeded once so "back" can leave it.
  const flat = useTrackerFellows(Boolean(initialOwnerId));
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !initialOwnerId) return;
    const hit = (flat.data ?? []).find((f) => f.id === initialOwnerId);
    if (!hit) return;
    setPerson({ id: hit.id, name: hit.name });
    setSeeded(true);
  }, [flat.data, initialOwnerId, seeded]);

  const goTo = (depth: number) => { setPerson(null); setPath((p) => p.slice(0, depth)); setQ(""); setRoleFilter(""); };
  const openRow = (m: TrackerTeamMember) => {
    if (m.report_count > 0) { setPath((p) => [...p, { id: m.id, name: m.name }]); setQ(""); setRoleFilter(""); }
    else setPerson({ id: m.id, name: m.name });
  };

  const crumbs = (
    <nav aria-label="Team path" className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" onClick={() => goTo(0)} className={"font-medium " + (path.length === 0 && !person ? "text-gray-950" : "text-teal-700 hover:underline")}>Your team</button>
      {path.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <button type="button" onClick={() => goTo(i + 1)} className={"font-medium " + (i === path.length - 1 && !person ? "text-gray-950" : "text-teal-700 hover:underline")}>{p.name}</button>
        </span>
      ))}
      {person && (
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <span className="font-medium text-gray-950">{person.name}</span>
        </span>
      )}
    </nav>
  );

  if (person) {
    return (
      <div className="flex flex-col gap-3">
        {crumbs}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-950">{person.name}&apos;s tasks</h3>
          {canAuthor && onAssign && <AssignTaskButton onClick={() => onAssign(person)} />}
        </div>
        {ownTasks.isLoading ? <Loading /> : <TaskListView tasks={ownTasks.data ?? []} onOpen={(tid) => onOpen(tid, person.id, person.name)} emptyTitle="No tasks" emptyDetail={`${person.name} has no tasks yet.`} />}
      </div>
    );
  }

  const rows = level.data ?? [];
  const roles = Array.from(new Set(rows.map((m) => m.role))).sort();
  const shown = rows.filter((m) =>
    (!roleFilter || m.role === roleFilter) && m.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      {crumbs}

      {current && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-950">{current.name}&apos;s own tasks</h3>
            {canAuthor && onAssign && <AssignTaskButton onClick={() => onAssign(current)} />}
          </div>
          {ownTasks.isLoading ? <Loading /> : <TaskListView tasks={ownTasks.data ?? []} onOpen={(tid) => onOpen(tid, current.id, current.name)} emptyTitle="No tasks" emptyDetail={`${current.name} has no tasks assigned directly.`} />}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-950">{current ? `Reports to ${current.name}` : "Your team"}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {roles.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">Role
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-teal-500">
                  <option value="">All</option>
                  {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </label>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team…" className="h-9 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500" />
          </div>
        </div>
        {level.isLoading ? (
          <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">{current ? `Nobody reports to ${current.name}.` : "Staff you manage will appear here."}</p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">No team members match.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-1">
                <button type="button" onClick={() => openRow(m)}
                  className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-3.5 text-left text-sm transition-colors hover:bg-teal-50">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                      {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                    <span className="truncate">{m.name}</span>
                    <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{roleLabel(m.role)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden items-center gap-2 text-xs sm:flex">
                      {m.report_count > 0 && (<><span className="text-gray-500">{m.report_count} report{m.report_count === 1 ? "" : "s"}</span><span className="text-gray-300">·</span></>)}
                      <span className="font-semibold text-emerald-700">{m.own_done} done</span>
                      <span className="text-gray-300">·</span>
                      <span className="font-semibold text-amber-700">{m.own_pending} left</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition group-hover:bg-teal-100">
                      {m.report_count > 0 ? "Open" : "View tasks"} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </span>
                </button>
                {canAuthor && m.own_pending > 0 && (
                  <NudgeButton doerId={m.id} lastNudgedAt={m.last_nudged_all_at} label="Nudge all" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** "Assign task" affordance shown above a person's task list — hands the caller off to the
 *  builder with that person already picked, so an empty list is a starting point, not a wall. */
export function AssignTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
    >
      <Plus className="h-4 w-4" aria-hidden="true" /> Assign task
    </button>
  );
}
