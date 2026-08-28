"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  LayoutList,
  Loader2,
  PencilRuler,
  Send,
  Table2,
  X,
  Users,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  useAddBlockerComment,
  useBlockerThread,
  useClearTrackerBlocker,
  useTrackerFellows,
  useTrackerFellowTasks,
  useTrackerGrid,
  useTrackerMineBlockers,
  useTrackerOverview,
  useTrackerQueueBlockers,
  useTrackerTemplate,
  useTrackerTemplates,
} from "@/lib/queries/tracker";
import type { TrackerBlocker, TrackerEvent, TrackerGrid, TrackerTaskSummaryRow, TrackerTemplate } from "@/lib/tracker-api";
import { IN_CHARGE, roleLabel, TRACKER_NAME } from "@/lib/labels";
import { getBackHref } from "@/lib/nav";
import { TrackerBuilder, type TrackerAssignPrefill } from "./_components/tracker-builder";
import { StudentFieldsManager } from "./_components/student-fields-manager";
import { TrackerEditableGrid } from "./_components/tracker-grid";
import { StatusCards } from "./_components/status-cards";
import { countByTaskState, rollupFromCounts, TASK_STATE_META, type StateCounts, type TaskState } from "@/lib/tracker-status";
import { TaskDetail } from "./_components/task-detail";
import { MyTasksList, TaskListView } from "./_components/my-tasks";
import { AllTasksPanel } from "./_components/all-tasks";
import { TaskBreakdown } from "./_components/task-breakdown";
import { ZmView, AssignTaskButton } from "./_components/zm-view";
import { NudgeButton } from "./_components/nudge-button";
import PushNudge from "@/components/PushNudge";
import { HierarchicalStudentsPanel } from "./_components/hierarchical-students";
import { GraduationCap } from "lucide-react";

type TrackerTab = "allTasks" | "myTasks" | "blockers" | "builder" | "studentDetails" | "myStudents";

const tabLabels: Record<TrackerTab, string> = {
  allTasks: "All Tasks",
  myTasks: "Tasks",
  blockers: "Blockers",
  myStudents: "Team & Students",
  builder: "New task",
  studentDetails: "Fields Setup",
};

export default function TrackerPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const canAuthor = has(PERM.tracker.author);
  const canFill = has(PERM.tracker.fill);
  const canOverrideFill = has(PERM.tracker.fill_override);
  const canClear = has(PERM.tracker.blocker_clear);
  const canAdmin = has(PERM.tracker.admin);
  const isManagerView = canAuthor || canClear || canAdmin;
  const roleCode = currentUser?.role?.code ?? "";
  const isPmOrAdmin = roleCode === "PROGRAM_MANAGER" || roleCode === "SUPER_ADMIN";

  const tabs = useMemo<TrackerTab[]>(() => {
    const next: TrackerTab[] = [];
    if (isPmOrAdmin || roleCode === "ZONAL_MANAGER") next.push("allTasks"); // task-first drill — PM/Admin/ZM
    if (canFill || isManagerView) next.push("myTasks");   // own task list — fellows + managers
    next.push("blockers");
    if (canFill || isManagerView) next.push("myStudents"); // own students list
    if (canAuthor) next.push("builder");                   // new + manage templates
    if (canAuthor) next.push("studentDetails");            // student additional details setup
    return next;
  }, [canAuthor, canFill, isManagerView, isPmOrAdmin, roleCode]);

  /**
   * `?task=<templateId>` opens straight into that task's grid — the link a student
   * profile (or any other page) uses to hand off to the tracker. It only seeds the
   * initial state: once here, the tab and task are ordinary local state again, so
   * navigating away from the task does not fight the URL.
   */
  const searchParams = useSearchParams();
  const deepLinkTask = searchParams.get("task");
  // Where the deep link came from, so "back" returns there instead of dropping the
  // user in a tracker list they never chose. Validated against internal dashboard
  // paths by getBackHref.
  const deepLinkFrom = searchParams.get("from");

  const [activeTab, setActiveTab] = useState<TrackerTab>("myTasks");
  const [teamView, setTeamView] = useState<"zm" | "fellow">("zm");
  // Manager overview: when a status card is clicked, show only the tasks in that state
  // (replacing the team roster) until cleared. Null = no filter, show the roster.
  const [overviewState, setOverviewState] = useState<TaskState | null>(null);
  const [fillTemplateId, setFillTemplateId] = useState<string | null>(deepLinkTask);
  // Set when a manager drills into a task from one fellow's list, so the grid scopes to that
  // fellow's rows instead of the manager's whole scope. Null = caller's own scope.
  const [fillFellowId, setFillFellowId] = useState<string | null>(null);
  // Their name, carried alongside the id purely so the fill-on-behalf banner can say WHO the
  // manager is writing as. Not every drill-in surface knows the id AND the name, so it is
  // optional and the banner falls back to a generic phrase.
  const [fillFellowName, setFillFellowName] = useState<string | null>(null);
  // The task whose org-tree drill-down is open on the All Tasks tab. Null = task list.
  const [drillTask, setDrillTask] = useState<TrackerTaskSummaryRow | null>(null);
  // Set when "Assign task" is clicked on someone's task list: seeds the builder's audience with
  // that person so the author lands on a form already pointed at them. Cleared on tab change so
  // a later visit to the builder starts blank.
  const [assignPrefill, setAssignPrefill] = useState<TrackerAssignPrefill | null>(null);
  const assignTo = (person: { id: string; name: string }) => {
    setAssignPrefill({ targetType: "fellow", ids: [person.id], label: person.name });
    setActiveTab("builder");
  };
  const safeActiveTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  const { data: templates = [], error: templatesError } = useTrackerTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(deepLinkTask ?? "");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null;
  const templateId = selectedTemplate?.id;

  const grid = useTrackerGrid(templateId, fillFellowId ?? undefined);
  const mine = useTrackerMineBlockers();
  const queue = useTrackerQueueBlockers();

  if (userLoading || permLoading) {
    return <TrackerLoading />;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {isManagerView && <PushNudge />}
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-semibold text-gray-950">{TRACKER_NAME}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {roleLabel(currentUser?.role.name, "Team")} workspace
          </p>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-gray-200" aria-label={`${TRACKER_NAME} sections`}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setAssignPrefill(null); setActiveTab(tab); }}
            className={
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors " +
              (safeActiveTab === tab
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-900")
            }
          >
            <TabIcon tab={tab} />
            {tabLabels[tab]}
          </button>
        ))}
      </nav>

      {templatesError ? (
        <ErrorPanel message={templatesError instanceof Error ? templatesError.message : "Failed to load tracker."} />
      ) : safeActiveTab === "allTasks" ? (
        fillTemplateId ? (
          <div className="flex flex-col gap-3">
            <BackFromTask
              from={deepLinkFrom}
              /* Only while still on the task the link sent us to — once the user picks a
                 different task inside the tracker, the origin is no longer where "back"
                 means, and the normal in-tracker back applies. */
              active={fillTemplateId === deepLinkTask}
              label="Back to task"
              onStay={() => { setFillTemplateId(null); setFillFellowId(null); setFillFellowName(null); }}
            />
            <GridPanel template={templates.find((t) => t.id === fillTemplateId) ?? null} grid={grid.data} loading={grid.isLoading} error={grid.error} canFill={canFill} canClear={canClear} viewingOther={Boolean(fillFellowId)} canOverrideFill={canOverrideFill && Boolean(fillFellowId)} owner={fillFellowId ? { id: fillFellowId, name: fillFellowName ?? "this team member" } : null} />
          </div>
        ) : drillTask ? (
          <TaskBreakdown
            task={drillTask}
            roleCode={roleCode}
            currentUserId={currentUser?.user.id ?? ""}
            canNudge={canAuthor}
            onBack={() => setDrillTask(null)}
          />
        ) : (
          <AllTasksPanel onOpenDrill={(task) => setDrillTask(task)} />
        )
      ) : safeActiveTab === "myTasks" ? (
        fillTemplateId ? (
          <div className="flex flex-col gap-3">
            <BackFromTask
              from={deepLinkFrom}
              /* Only while still on the task the link sent us to — once the user picks a
                 different task inside the tracker, the origin is no longer where "back"
                 means, and the normal in-tracker back applies. */
              active={fillTemplateId === deepLinkTask}
              label="Back to my tasks"
              onStay={() => { setFillTemplateId(null); setFillFellowId(null); setFillFellowName(null); }}
            />
            <GridPanel template={templates.find((t) => t.id === fillTemplateId) ?? null} grid={grid.data} loading={grid.isLoading} error={grid.error} canFill={canFill} canClear={canClear} viewingOther={Boolean(fillFellowId)} canOverrideFill={canOverrideFill && Boolean(fillFellowId)} owner={fillFellowId ? { id: fillFellowId, name: fillFellowName ?? "this team member" } : null} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {canAuthor ? (
              <>
              <OverviewStrip activeState={overviewState} onSelect={(s) => setOverviewState((prev) => (prev === s ? null : s))} />
              {overviewState ? (
                <OverviewFilteredTasks
                  state={overviewState}
                  onClear={() => setOverviewState(null)}
                  onOpen={(tid) => { setSelectedTemplateId(tid); setFillTemplateId(tid); setFillFellowId(null); setFillFellowName(null); }}
                />
              ) : isPmOrAdmin ? (
                <div className="flex flex-col gap-3">
                  <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
                    <button type="button" onClick={() => setTeamView("zm")} className={"rounded-md px-3 py-1.5 text-sm font-medium transition " + (teamView === "zm" ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900")}>By Zonal Manager</button>
                    <button type="button" onClick={() => setTeamView("fellow")} className={"rounded-md px-3 py-1.5 text-sm font-medium transition " + (teamView === "fellow" ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900")}>By {IN_CHARGE}</button>
                  </div>
                  {teamView === "zm"
                    ? <ZmView onOpen={(tid, fid, fname) => { setSelectedTemplateId(tid); setFillTemplateId(tid); setFillFellowId(fid); setFillFellowName(fname ?? null); }} onAssign={canAuthor ? assignTo : undefined} />
                    : <TeamPanel onOpen={(tid, fid, fname) => { setSelectedTemplateId(tid); setFillTemplateId(tid); setFillFellowId(fid); setFillFellowName(fname ?? null); }} onAssign={canAuthor ? assignTo : undefined} />}
                </div>
              ) : (
                <TeamPanel onOpen={(tid, fid, fname) => { setSelectedTemplateId(tid); setFillTemplateId(tid); setFillFellowId(fid); setFillFellowName(fname ?? null); }} onAssign={canAuthor ? assignTo : undefined} />
              )}
              </>
            ) : (
              <MyTasksList onOpen={(tid) => { setSelectedTemplateId(tid); setFillTemplateId(tid); setFillFellowId(null); setFillFellowName(null); }} />
            )}
          </div>
        )
      ) : safeActiveTab === "blockers" ? (
        <BlockersPanel
          mine={mine.data ?? []}
          queue={queue.data ?? []}
          mineLoading={mine.isLoading}
          queueLoading={queue.isLoading}
          mineError={mine.error}
          queueError={queue.error}
          isManagerView={isManagerView}
          canClear={canClear}
        />
      ) : safeActiveTab === "studentDetails" ? (
        <div className="flex flex-col gap-4">
          <StudentFieldsManager canAuthor={canAuthor} />
        </div>
      ) : safeActiveTab === "myStudents" ? (
        <HierarchicalStudentsPanel />
      ) : (
        <NewTaskPanel canAuthor={canAuthor} canFill={canFill} canClear={canClear} prefill={assignPrefill} />
      )}
    </div>
  );
}

function TasksPanel({
  templates,
  loading,
  selectedId,
  onSelect,
}: {
  templates: TrackerTemplate[];
  loading: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const overview = useTrackerOverview();
  if (loading) return <TrackerLoading />;
  if (templates.length === 0) {
    return <EmptyPanel title="No templates yet" detail="Create your first one in the “New task” tab, then assign it to staff, schools, or students." />;
  }

  const perTask = new Map((overview.data?.perTask ?? []).map((p) => [p.template_id, p]));

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Template</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Due by</th>
                <th className="px-4 py-3 font-semibold">Done</th>
                <th className="px-4 py-3 font-semibold">Pending</th>
                <th className="px-4 py-3 font-semibold">Blocked</th>
                <th className="px-4 py-3 font-semibold">Overdue</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const c = perTask.get(template.id);
                return (
                  <tr
                    key={template.id}
                    onClick={() => onSelect(template.id)}
                    className={
                      "cursor-pointer border-t border-gray-100 transition-colors hover:bg-teal-50/50 " +
                      (template.id === selectedId ? "bg-teal-50" : "bg-white")
                    }
                  >
                    <td className="px-4 py-3 font-medium text-gray-950">{template.name}</td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold capitalize text-gray-600">{template.priority}</span></td>
                    <td className="px-4 py-3 text-gray-600">{template.deadline ? formatDate(template.deadline) : "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c?.done ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c?.pending ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c?.blocked ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c?.overdue ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={template.status === "active" ? "Active" : template.status} tone={template.status === "active" ? "green" : "gray"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TeamPanel({ onOpen, onAssign }: {
  onOpen: (templateId: string, fellowId: string, fellowName?: string) => void;
  /** Jump to the task builder with this person pre-selected as the audience. */
  onAssign?: (person: { id: string; name: string }) => void;
}) {
  const { data: fellows = [], isLoading } = useTrackerFellows();
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [q, setQ] = useState("");
  const tasks = useTrackerFellowTasks(sel?.id);
  const canNudge = usePermissions().has(PERM.tracker.author);

  if (sel) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to team
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-950">{sel.name}&apos;s tasks</h3>
          {onAssign && <AssignTaskButton onClick={() => onAssign(sel)} />}
        </div>
        {tasks.isLoading ? <TrackerLoading /> : <TaskListView tasks={tasks.data ?? []} onOpen={(tid) => onOpen(tid, sel.id, sel.name)} emptyTitle="No tasks" emptyDetail={`${sel.name} has no tasks yet.`} />}
      </div>
    );
  }

  if (isLoading) return <TrackerLoading />;
  if (fellows.length === 0) return <EmptyPanel title="No team members" detail="Staff you manage will appear here." />;

  const shown = fellows.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-gray-950">Your team</h3>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team…" className="h-9 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500" />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-500">No team members match “{q}”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => setSel({ id: f.id, name: f.name })}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-3.5 text-left text-sm transition-colors hover:bg-teal-50"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                    {f.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span className="truncate">{f.name}</span>
                  {f.role && f.role !== "FELLOW" && (
                    <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                      {f.role === "ZONAL_MANAGER" ? "ZM" : f.role === "PROGRAM_MANAGER" ? "PM" : f.role}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden items-center gap-2 text-xs sm:flex">
                    <span className="font-semibold text-emerald-700">{f.done} done</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-500">{f.total} assigned</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-semibold text-amber-700">{f.pending} left</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition group-hover:bg-teal-100">
                    View tasks <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </span>
              </button>
              {canNudge && f.pending > 0 && (
                <NudgeButton doerId={f.id} lastNudgedAt={f.last_nudged_all_at} label="Nudge all" />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewTaskPanel({ canAuthor, canFill, canClear, prefill }: {
  canAuthor: boolean;
  canFill: boolean;
  canClear: boolean;
  /** Audience carried in from an "Assign task" click, which also opens the scratch builder. */
  prefill?: TrackerAssignPrefill | null;
}) {
  const [mode, setMode] = useState<"template" | "scratch">(prefill ? "scratch" : "template");
  const [listView, setListView] = useState<"active" | "archived">("active");
  const { data: templates = [], isLoading } = useTrackerTemplates(listView === "archived" ? "archived" : undefined);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [gridId, setGridId] = useState<string | null>(null);
  const grid = useTrackerGrid(gridId ?? undefined);

  const tabCls = (on: boolean) =>
    "rounded-md px-3 py-1.5 text-sm font-medium transition " + (on ? "bg-teal-600 text-white" : "text-gray-600 hover:text-gray-900");

  if (gridId) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setGridId(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to template
        </button>
        <GridPanel template={templates.find((t) => t.id === gridId) ?? null} grid={grid.data} loading={grid.isLoading} error={grid.error} canFill={canFill} canClear={canClear} />
      </div>
    );
  }
  if (detailId) {
    return (
      <TaskDetailRoute
        templateId={detailId}
        fallback={templates.find((t) => t.id === detailId) ?? null}
        canAuthor={canAuthor}
        onBack={() => setDetailId(null)}
        onOpenGrid={() => setGridId(detailId)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
          <button type="button" onClick={() => setMode("template")} className={tabCls(mode === "template")}>Use existing</button>
          <button type="button" onClick={() => setMode("scratch")} className={tabCls(mode === "scratch")}>Create new</button>
        </div>
        {mode === "template" && (
          <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
            <button type="button" onClick={() => setListView("active")} className={tabCls(listView === "active")}>Active</button>
            <button type="button" onClick={() => setListView("archived")} className={tabCls(listView === "archived")}>Archived</button>
          </div>
        )}
      </div>
      {mode === "template"
        ? <TasksPanel templates={templates} loading={isLoading} selectedId={undefined} onSelect={(id) => setDetailId(id)} />
        : (
          <TrackerBuilder
            // Remount when the pre-selected audience changes — the builder only reads it on mount.
            key={prefill ? `prefill:${prefill.ids.join(",")}` : "blank"}
            canAuthor={canAuthor}
            prefill={prefill ?? undefined}
            // Land the author on the task they just made instead of the list.
            onCreated={(id) => { setListView("active"); setMode("template"); setDetailId(id); }}
          />
        )}
    </div>
  );
}

/** Opens one task by id. Resolving from the detail endpoint (not the cached list) means a
 *  freshly-created task — including a draft — opens right away, before the list refetch lands. */
function TaskDetailRoute({
  templateId,
  fallback,
  canAuthor,
  onBack,
  onOpenGrid,
}: {
  templateId: string;
  fallback: TrackerTemplate | null;
  canAuthor: boolean;
  onBack: () => void;
  onOpenGrid: () => void;
}) {
  const { data, isLoading, error } = useTrackerTemplate(templateId);
  const template = data?.template ?? fallback;

  if (!template) {
    if (isLoading) return <TrackerLoading />;
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tasks
        </button>
        <ErrorPanel message={error instanceof Error ? error.message : "Could not open that task."} />
      </div>
    );
  }

  return <TaskDetail template={template} canAuthor={canAuthor} onBack={onBack} onOpenGrid={onOpenGrid} />;
}

/** Global strip: counts TASKS (not records) bucketed by each task's rolled-up state.
 *  Cards are filter toggles — clicking one shows only that state's tasks below. */
function OverviewStrip({ activeState, onSelect }: { activeState: TaskState | null; onSelect: (s: TaskState) => void }) {
  const overview = useTrackerOverview();
  const counts: StateCounts = { done: 0, pending: 0, blocked: 0, overdue: 0 };
  for (const task of overview.data?.perTask ?? []) {
    const state = rollupFromCounts(task); // null for a task with no records in scope — skip it
    if (state) counts[state] += 1;
  }
  return <StatusCards counts={counts} activeState={activeState} onSelect={onSelect} />;
}

/** Tasks whose rolled-up state matches the clicked overview card. Program-wide for PM/Admin,
 *  team-wide for a ZM — both come from the same overview endpoint, so counts match the card
 *  exactly. Opening a task drills into its whole-scope grid. */
function OverviewFilteredTasks({
  state,
  onOpen,
  onClear,
}: {
  state: TaskState;
  onOpen: (templateId: string) => void;
  onClear: () => void;
}) {
  const overview = useTrackerOverview();
  const meta = TASK_STATE_META[state];
  const tasks = (overview.data?.perTask ?? []).filter((t) => rollupFromCounts(t) === state);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-950">{meta.label} tasks</h3>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
          <X className="h-4 w-4" aria-hidden="true" /> Clear filter
        </button>
      </div>
      {overview.isLoading ? (
        <TrackerLoading />
      ) : tasks.length === 0 ? (
        <EmptyPanel title={`No ${meta.label.toLowerCase()} tasks`} detail="Nothing matches this status right now." />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {tasks.map((task) => {
            const total = task.done + task.pending + task.blocked + task.overdue;
            return (
              <li key={task.template_id}>
                <button
                  type="button"
                  onClick={() => onOpen(task.template_id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-teal-50/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-950">{task.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{task.done}/{total} done · {total} target{total === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill label={meta.label} tone={meta.tone} />
                    <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The back control above a task's grid.
 *
 * Arriving from another page (a student profile, say) and arriving from the tracker's
 * own list are different journeys, so "back" cannot be one fixed destination: it either
 * leaves for where the link came from, or clears the task and stays.
 */
function BackFromTask({
  from,
  active,
  label,
  onStay,
}: {
  from: string | null;
  active: boolean;
  label: string;
  onStay: () => void;
}) {
  const className =
    "inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900";
  if (active && from) {
    const href = getBackHref(from, "");
    if (href) {
      return (
        <Link href={href} className={className}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
      );
    }
  }
  return (
    <button type="button" onClick={onStay} className={className}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  );
}

function GridPanel({
  template,
  grid,
  loading,
  error,
  canFill,
  canClear,
  viewingOther = false,
  canOverrideFill = false,
  owner = null,
}: {
  template: TrackerTemplate | null;
  grid: TrackerGrid | undefined;
  loading: boolean;
  error: unknown;
  canFill: boolean;
  canClear: boolean;
  /** Drilled into another person's rows (a manager reviewing a fellow). */
  viewingOther?: boolean;
  /** May the viewer take those rows over and fill them in the owner's name? */
  canOverrideFill?: boolean;
  /** Who those rows belong to, for the fill-on-behalf banner. */
  owner?: { id: string; name: string } | null;
}) {
  const perms = usePermissions();
  const canOverrideGeo = perms.has(PERM.tracker.geo_override);
  const canGrantExtension = perms.has(PERM.tracker.extension_grant);
  // Managers only. A doer already has the fill template download; the export is the
  // reporting pull, and it carries every row plus its audit trail.
  const canExport = perms.has(PERM.tracker.author) || perms.has(PERM.tracker.admin)
    || perms.has(PERM.tracker.blocker_clear);
  if (!template) return <EmptyPanel title="No task selected" detail="Choose a task type to view rows." />;
  if (loading) return <TrackerLoading />;
  if (error) return <ErrorPanel message={error instanceof Error ? error.message : "Failed to load grid."} />;
  if (!grid || grid.rows.length === 0) return <EmptyPanel title="No rows" detail="Assigned rows will appear here." />;

  // Per-task breakdown of THIS task's targets. Skipped for a single-target task (1/0/0/0 is noise).
  const counts = grid.rows.length > 1 ? countByTaskState(grid.rows.map((r) => r.lifecycle)) : null;
  return (
    <div className="flex flex-col gap-4">
      {counts && <StatusCards counts={counts} />}
      <TrackerEditableGrid
        template={template}
        grid={grid}
        canFill={canFill}
        canClear={canClear}
        viewingOther={viewingOther}
        canOverrideGeo={canOverrideGeo}
        canGrantExtension={canGrantExtension}
        canOverrideFill={canOverrideFill}
        canExport={canExport}
        owner={owner}
      />
    </div>
  );
}

function BlockersPanel({
  mine,
  queue,
  mineLoading,
  queueLoading,
  mineError,
  queueError,
  isManagerView,
  canClear,
}: {
  mine: TrackerBlocker[];
  queue: TrackerBlocker[];
  mineLoading: boolean;
  queueLoading: boolean;
  mineError: unknown;
  queueError: unknown;
  isManagerView: boolean;
  canClear: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <BlockerList title="Raised by me" blockers={mine} loading={mineLoading} error={mineError} canClear={canClear} onOpen={setOpenId} />
        {isManagerView && (
          <BlockerList title="Needs my attention" blockers={queue} loading={queueLoading} error={queueError} canClear={canClear} onOpen={setOpenId} />
        )}
      </div>
      {openId && <BlockerDrawer blockerId={openId} canClear={canClear} onClose={() => setOpenId(null)} />}
    </>
  );
}

function BlockerList({
  title,
  blockers,
  loading,
  error,
  canClear,
  onOpen,
}: {
  title: string;
  blockers: TrackerBlocker[];
  loading: boolean;
  error: unknown;
  canClear: boolean;
  onOpen: (id: string) => void;
}) {
  const clear = useClearTrackerBlocker();
  if (loading) return <TrackerLoading />;
  if (error) return <ErrorPanel message={error instanceof Error ? error.message : "Failed to load blockers."} />;

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
      </div>
      {blockers.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-500">No blockers.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {blockers.map((blocker) => (
            <li
              key={blocker.id}
              onClick={() => onOpen(blocker.id)}
              className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <div>
                {blocker.task_name && (
                  <p className="text-xs font-medium text-teal-700">
                    {blocker.task_name}{blocker.target_name ? ` · ${blocker.target_name}` : ""}
                  </p>
                )}
                <p className="text-sm font-medium text-gray-950">{blocker.text}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Raised {formatDate(blocker.raised_at)}
                  {blocker.escalated_to_pm_at ? " · escalated to PM" : blocker.escalated_to_zm_at ? " · escalated to ZM" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpen(blocker.id); }}
                  className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                >
                  Respond
                </button>
                {canClear && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clear.mutate(blocker.id); }}
                    disabled={clear.isPending}
                    className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


function StatusPill({ label, tone }: { label: string; tone: "green" | "gray" | "red" | "amber" }) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${toneClass}`}>{label}</span>;
}

function BlockerDrawer({ blockerId, canClear, onClose }: { blockerId: string; canClear: boolean; onClose: () => void }) {
  const { data, isLoading, error } = useBlockerThread(blockerId);
  const comment = useAddBlockerComment();
  const clear = useClearTrackerBlocker();
  const [text, setText] = useState("");

  async function send() {
    if (!text.trim()) return;
    await comment.mutateAsync({ blockerId, text: text.trim() });
    setText("");
  }

  const blocker = data?.blocker;
  const open = blocker?.status === "open";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Blocker">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-950">Blocker</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
        ) : error || !blocker ? (
          <p className="p-4 text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load."}</p>
        ) : (
          <>
            <div className="border-b border-gray-100 px-4 py-3">
              {blocker.task_name && (
                <p className="text-xs font-medium text-teal-700">
                  {blocker.task_name}{blocker.target_name ? ` · ${blocker.target_name}` : ""}
                </p>
              )}
              <p className="mt-0.5 text-sm font-medium text-gray-950">{blocker.text}</p>
              <p className="mt-1 text-xs text-gray-500">
                Raised by {blocker.raised_by_name ?? "someone"} · {formatDate(blocker.raised_at)}
                {blocker.escalated_to_pm_at ? " · escalated to PM" : blocker.escalated_to_zm_at ? " · escalated to ZM" : ""}
                {blocker.status === "cleared" ? " · cleared" : ""}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <ol className="flex flex-col gap-3">
                {data!.events.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900">{describeBlockerEvent(ev)}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{ev.actor_name ? `${ev.actor_name} · ` : ""}{formatDate(ev.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-gray-100 p-3">
              {open ? (
                <>
                  <div className="flex items-end gap-2">
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="How can this be cleared? Write a response…" className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500" />
                    <button type="button" onClick={send} disabled={comment.isPending || !text.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                      {comment.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Send
                    </button>
                  </div>
                  {canClear && (
                    <button type="button" onClick={() => clear.mutate(blocker.id, { onSuccess: onClose })} disabled={clear.isPending} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      Mark cleared
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">This blocker is cleared.</p>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function describeBlockerEvent(ev: TrackerEvent): string {
  const d = ev.detail as Record<string, unknown>;
  switch (ev.event_type) {
    case "blocker_raised": return `Flagged stuck: "${String(d.text ?? "")}"`;
    case "blocker_comment": return String(d.text ?? "");
    case "blocker_escalated": return `Escalated to ${roleLabel(d.to_role as string | null, "manager")}`;
    case "blocker_cleared": return "Blocker cleared";
    default: return ev.event_type;
  }
}

function TabIcon({ tab }: { tab: TrackerTab }) {
  const props = { className: "h-4 w-4", "aria-hidden": true };
  if (tab === "allTasks") return <LayoutList {...props} />;
  if (tab === "myTasks") return <Table2 {...props} />;
  if (tab === "blockers") return <AlertCircle {...props} />;
  if (tab === "myStudents") return <GraduationCap {...props} />;
  if (tab === "studentDetails") return <Users {...props} />;
  return <PencilRuler {...props} />;
}

function TrackerLoading() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white">
      <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
      <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
      <p className="text-sm font-medium text-red-800">{message}</p>
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-center">
      <CheckCircle2 className="h-6 w-6 text-gray-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-gray-950">{title}</p>
      <p className="text-sm text-gray-500">{detail}</p>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
