"use client";

import React, { useState } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getStudentRoster } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useTrackerPms,
  useTrackerPmZms,
  useTrackerZmFellows,
  useTrackerFellows,
  useTrackerFellowSchools,
  useTrackerSchoolStudents,
  useTrackerZms,
} from "@/lib/queries/tracker";
import { StudentDetailsForm } from "./student-details-form";
import { IN_CHARGE_PLURAL } from "@/lib/labels";

type Level = "pm" | "zm" | "fellow" | "school" | "student";
type Crumb = { level: Level; id: string; name: string };
type HierarchyItem = {
  id: string; name: string; zm_count?: number; fellow_count?: number;
  state?: string | null; district?: string | null;
  programme?: string | null; programme_type?: string | null;
};

function getHomeLabel(startLevel: Level): string {
  switch (startLevel) {
    case "pm": return "Program Managers";
    case "zm": return "Zonal Managers";
    case "fellow": return IN_CHARGE_PLURAL;
    case "school": return "Schools";
    default: return "Students";
  }
}

function getListTitle(level: Level, parentName?: string): string {
  if (parentName) {
    switch (level) {
      case "zm": return `Zonal Managers under ${parentName}`;
      case "fellow": return `${IN_CHARGE_PLURAL} under ${parentName}`;
      case "school": return `Schools assigned to ${parentName}`;
      case "student": return `Students in ${parentName}`;
    }
  }
  switch (level) {
    case "pm": return "Program Managers";
    case "zm": return "Your Zonal Managers";
    case "fellow": return `Your ${IN_CHARGE_PLURAL}`;
    case "school": return "Your Schools";
    default: return "Students";
  }
}

export function HierarchicalStudentsPanel() {
  const { has, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!has(PERM.students.view)) return <p>You do not have permission to view students.</p>;
  return <ScopedStudentsPanel />;
}

function ScopedStudentsPanel() {
  const canFill = usePermissions().has(PERM.tracker.fill);
  const [startLevel, setStartLevel] = useState<Level>("student");
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [path, setPath] = useState<Crumb[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  if (userLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
      </div>
    );
  }

  if (!user) return null;

  const currentLevel = path.length > 0 ? getNextLevel(path[path.length - 1].level) : startLevel;
  const currentParentId = path.length > 0 ? path[path.length - 1].id : null;
  const currentParentName = path.length > 0 ? path[path.length - 1].name : undefined;

  // We should never be at a state where currentLevel is null, 
  // because clicking a student opens the form, it doesn't push to path.
  if (!currentLevel) return null;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-gray-600">Browse
        <select aria-label="Browse team and students" value={startLevel} onChange={event => { setStartLevel(event.target.value as Level); setPath([]); }} className="rounded-md border border-gray-300 bg-white px-2 py-1">
          {(["student", "pm", "zm", "fellow"] as Level[]).map(level => <option key={level} value={level}>{getHomeLabel(level)}</option>)}
        </select>
      </label>
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600 px-1">
          <button
            type="button"
            onClick={() => setPath([])}
            className="rounded-md px-2 py-1 font-medium hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            {getHomeLabel(startLevel)}
          </button>
          {path.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setPath(path.slice(0, i + 1))}
                className={`rounded-md px-2 py-1 transition-colors hover:bg-gray-100 hover:text-gray-900 ${
                  i === path.length - 1 ? "font-semibold text-gray-900" : "font-medium"
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      <LevelRenderer
        key={`${currentLevel}:${currentParentId ?? "root"}`}
        canFill={canFill}
        level={currentLevel as Level}
        parentId={currentParentId}
        parentName={currentParentName}
        userId={user.user.id}
        onSelect={(crumb) => {
          if (crumb.level === "student") {
            setSelectedStudent({ id: crumb.id, name: crumb.name });
          } else {
            setPath([...path, crumb]);
          }
        }}
      />

      {selectedStudent && (
        <StudentDetailsForm
          readOnly={!canFill}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

function getNextLevel(level: Level): Level | null {
  switch (level) {
    case "pm": return "zm";
    case "zm": return "fellow";
    case "fellow": return "school";
    case "school": return "student";
    case "student": return null;
  }
}

function LevelRenderer({
  level,
  canFill,
  parentId,
  parentName,
  userId,
  onSelect,
}: {
  level: Level;
  canFill: boolean;
  parentId: string | null;
  parentName?: string;
  userId: string;
  onSelect: (crumb: Crumb) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const rootStudents = level === "student" && !parentId;
  const rosterQuery = useQuery({ queryKey: ["og", "student", "tracker-roster", userId, q, page], queryFn: () => getStudentRoster({ search: q || undefined, limit: 50, offset: page * 50 }), enabled: rootStudents });

  const pmsQuery = useTrackerPms(level === "pm");
  const zmsQuery = useTrackerZms(level === "zm" && !parentId);
  const pmZmsQuery = useTrackerPmZms(level === "zm" && parentId ? parentId : undefined);
  const fellowsQuery = useTrackerFellows(level === "fellow" && !parentId);
  const zmFellowsQuery = useTrackerZmFellows(level === "fellow" && parentId ? parentId : undefined);
  const fellowSchoolsQuery = useTrackerFellowSchools(level === "school" ? (parentId || userId) : undefined);
  const schoolStudentsQuery = useTrackerSchoolStudents(level === "student" && parentId ? parentId : undefined);

  let data: HierarchyItem[] | undefined;
  let isLoading = false;
  let error: unknown = null;
  let getProps: (item: HierarchyItem) => { id: string; name: string; subtitle: string; rightItem?: React.ReactNode } = () => ({
    id: "",
    name: "",
    subtitle: "",
  });

  if (level === "pm") {
    data = pmsQuery.data;
    isLoading = pmsQuery.isLoading;
    error = pmsQuery.error;
    getProps = (p) => ({
      id: p.id,
      name: p.name,
      subtitle: `${p.zm_count} ZMs`,
    });
  } else if (level === "zm") {
    const qNode = parentId ? pmZmsQuery : zmsQuery;
    data = qNode.data;
    isLoading = qNode.isLoading;
    error = qNode.error;
    getProps = (z) => ({
      id: z.id,
      name: z.name,
      subtitle: `${z.fellow_count} ${IN_CHARGE_PLURAL}`,
    });
  } else if (level === "fellow") {
    const qNode = parentId ? zmFellowsQuery : fellowsQuery;
    data = qNode.data;
    isLoading = qNode.isLoading;
    error = qNode.error;
    getProps = (f) => ({
      id: f.id,
      name: f.name,
      subtitle: f.state ? f.state : "No state",
    });
  } else if (level === "school") {
    data = fellowSchoolsQuery.data;
    isLoading = fellowSchoolsQuery.isLoading;
    error = fellowSchoolsQuery.error;
    getProps = (s) => ({
      id: s.id,
      name: s.name,
      subtitle: s.district ? `${s.district}${s.state ? `, ${s.state}` : ""}` : s.state || "No location",
    });
  } else if (level === "student") {
    data = rootStudents ? rosterQuery.data?.items : schoolStudentsQuery.data;
    isLoading = rootStudents ? rosterQuery.isLoading : schoolStudentsQuery.isLoading;
    error = rootStudents ? rosterQuery.error : schoolStudentsQuery.error;
    getProps = (st) => ({
      id: st.id,
      name: st.name,
      subtitle: st.programme_type || st.programme || "No programme",
      rightItem: (
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition group-hover:border-teal-300 group-hover:bg-teal-50 group-hover:text-teal-700">
          {canFill ? "Edit details" : "View details"} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ),
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">
          {error instanceof Error ? error.message : "Failed to load data."}
        </p>
      </div>
    );
  }

  const shown = (data ?? []).filter((item) => getProps(item).name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-gray-950">{getListTitle(level, parentName)}</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Search…"
            className="h-9 w-64 rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-500">No results match “{q}”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((item) => {
            const props = getProps(item);
            return (
              <li key={props.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ level, id: props.id, name: props.name })}
                  className="group flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-teal-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-950">{props.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{props.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {props.rightItem ? (
                      props.rightItem
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition-colors group-hover:bg-teal-100">
                        View <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {rootStudents && <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span>{rosterQuery.data?.total ?? 0} students · Page {page + 1}</span>
        <button type="button" disabled={!rosterQuery.data?.has_more} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </section>
  );
}
