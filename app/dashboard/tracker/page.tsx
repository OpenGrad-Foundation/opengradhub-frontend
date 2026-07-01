"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PencilRuler,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  useClearTrackerBlocker,
  useTrackerGrid,
  useTrackerMineBlockers,
  useTrackerQueueBlockers,
  useTrackerSummary,
  useTrackerTemplates,
} from "@/lib/queries/tracker";
import type { TrackerBlocker, TrackerGrid, TrackerSummaryRow, TrackerTemplate } from "@/lib/tracker-api";
import { TrackerBuilder } from "./_components/tracker-builder";
import { TrackerEditableGrid } from "./_components/tracker-grid";
import { TaskDetail } from "./_components/task-detail";
import { MyTasksList } from "./_components/my-tasks";

type TrackerTab = "tasks" | "myTasks" | "blockers" | "summary" | "builder";

const tabLabels: Record<TrackerTab, string> = {
  tasks: "Tasks",
  myTasks: "My Tasks",
  blockers: "Stuck",
  summary: "Summary",
  builder: "New task",
};

export default function TrackerPage() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const canAuthor = has(PERM.tracker.author);
  const canFill = has(PERM.tracker.fill);
  const canClear = has(PERM.tracker.blocker_clear);
  const canAdmin = has(PERM.tracker.admin);
  const isManagerView = canAuthor || canClear || canAdmin;

  const tabs = useMemo<TrackerTab[]>(() => {
    const next: TrackerTab[] = [];
    if (canAuthor) next.push("tasks");          // task-type library (managers)
    if (canFill) next.push("myTasks");          // the fellow's own to-do list
    next.push("blockers");
    if (isManagerView) next.push("summary");
    if (canAuthor) next.push("builder");
    return next;
  }, [canAuthor, canFill, isManagerView]);

  const [activeTab, setActiveTab] = useState<TrackerTab>("myTasks");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fillTemplateId, setFillTemplateId] = useState<string | null>(null);
  const safeActiveTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useTrackerTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null;
  const templateId = selectedTemplate?.id;

  const grid = useTrackerGrid(templateId);
  const mine = useTrackerMineBlockers();
  const queue = useTrackerQueueBlockers();
  const summary = useTrackerSummary(templateId);

  if (userLoading || permLoading) {
    return <TrackerLoading />;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Hub Module</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-950">Tracker</h1>
          <p className="mt-2 text-sm text-gray-500">
            {currentUser?.role.name ?? "Team"} workspace
          </p>
        </div>
        {isManagerView && (
          <TemplateSelect
            templates={templates}
            selectedId={templateId ?? ""}
            loading={templatesLoading}
            onChange={setSelectedTemplateId}
          />
        )}
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-gray-200" aria-label="Tracker sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
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
      ) : safeActiveTab === "tasks" ? (
        detailId && templates.some((t) => t.id === detailId) ? (
          <TaskDetail
            template={templates.find((t) => t.id === detailId)!}
            canAuthor={canAuthor}
            onBack={() => setDetailId(null)}
          />
        ) : (
          <TasksPanel
            templates={templates}
            loading={templatesLoading}
            selectedId={templateId}
            onSelect={(id) => { setSelectedTemplateId(id); setDetailId(id); }}
          />
        )
      ) : safeActiveTab === "myTasks" ? (
        fillTemplateId ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setFillTemplateId(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my tasks
            </button>
            <GridPanel template={templates.find((t) => t.id === fillTemplateId) ?? null} grid={grid.data} loading={grid.isLoading} error={grid.error} canFill={canFill} />
          </div>
        ) : (
          <MyTasksList onOpen={(tid) => { setSelectedTemplateId(tid); setFillTemplateId(tid); }} />
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
      ) : safeActiveTab === "summary" ? (
        <SummaryPanel template={selectedTemplate} rows={summary.data ?? []} loading={summary.isLoading} error={summary.error} />
      ) : (
        <TrackerBuilder canAuthor={canAuthor} />
      )}
    </div>
  );
}

function TemplateSelect({
  templates,
  selectedId,
  loading,
  onChange,
}: {
  templates: TrackerTemplate[];
  selectedId: string;
  loading: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-gray-700 sm:min-w-72">
      Task type
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || templates.length === 0}
        className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-gray-50 disabled:text-gray-400"
      >
        {templates.length === 0 ? (
          <option value="">No task types</option>
        ) : (
          templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))
        )}
      </select>
    </label>
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
  if (loading) return <TrackerLoading />;
  if (templates.length === 0) {
    return <EmptyPanel title="No tasks yet" detail="Tasks assigned to you will appear here." />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Task</th>
            <th className="px-4 py-3 font-semibold">Due by</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr
              key={template.id}
              onClick={() => onSelect(template.id)}
              className={
                "cursor-pointer border-t border-gray-100 transition-colors hover:bg-teal-50/50 " +
                (template.id === selectedId ? "bg-teal-50" : "bg-white")
              }
            >
              <td className="px-4 py-3 font-medium text-gray-950">{template.name}</td>
              <td className="px-4 py-3 text-gray-600">{template.deadline ? formatDate(template.deadline) : "—"}</td>
              <td className="px-4 py-3">
                <StatusPill label={template.status === "active" ? "Active" : template.status} tone={template.status === "active" ? "green" : "gray"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function GridPanel({
  template,
  grid,
  loading,
  error,
  canFill,
}: {
  template: TrackerTemplate | null;
  grid: TrackerGrid | undefined;
  loading: boolean;
  error: unknown;
  canFill: boolean;
}) {
  if (!template) return <EmptyPanel title="No task selected" detail="Choose a task type to view rows." />;
  if (loading) return <TrackerLoading />;
  if (error) return <ErrorPanel message={error instanceof Error ? error.message : "Failed to load grid."} />;
  if (!grid || grid.rows.length === 0) return <EmptyPanel title="No rows" detail="Assigned rows will appear here." />;

  return <TrackerEditableGrid template={template} grid={grid} canFill={canFill} />;
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
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <BlockerList title="Things I'm stuck on" blockers={mine} loading={mineLoading} error={mineError} canClear={canClear} />
      {isManagerView && (
        <BlockerList title="Action Queue" blockers={queue} loading={queueLoading} error={queueError} canClear={canClear} />
      )}
    </div>
  );
}

function BlockerList({
  title,
  blockers,
  loading,
  error,
  canClear,
}: {
  title: string;
  blockers: TrackerBlocker[];
  loading: boolean;
  error: unknown;
  canClear: boolean;
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
            <li key={blocker.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-950">{blocker.text}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Raised {formatDate(blocker.raised_at)}
                  {blocker.escalated_to_pm_at ? " · escalated to PM" : blocker.escalated_to_zm_at ? " · escalated to ZM" : ""}
                </p>
              </div>
              {canClear && (
                <button
                  type="button"
                  onClick={() => clear.mutate(blocker.id)}
                  disabled={clear.isPending}
                  className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryPanel({
  template,
  rows,
  loading,
  error,
}: {
  template: TrackerTemplate | null;
  rows: TrackerSummaryRow[];
  loading: boolean;
  error: unknown;
}) {
  if (!template) return <EmptyPanel title="No task selected" detail="Choose a task type to view summary." />;
  if (loading) return <TrackerLoading />;
  if (error) return <ErrorPanel message={error instanceof Error ? error.message : "Failed to load summary."} />;

  const totals = rows.reduce(
    (acc, row) => ({
      done: acc.done + row.done,
      pending: acc.pending + row.pending,
      blocked: acc.blocked + row.blocked,
      overdue: acc.overdue + row.overdue,
    }),
    { done: 0, pending: 0, blocked: 0, overdue: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Done" value={totals.done} tone="green" />
        <Metric label="Pending" value={totals.pending} tone="gray" />
        <Metric label="Blocked" value={totals.blocked} tone="red" />
        <Metric label="Overdue" value={totals.overdue} tone="amber" />
      </section>
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Fellow</th>
              <th className="px-4 py-3 font-semibold">Done</th>
              <th className="px-4 py-3 font-semibold">Pending</th>
              <th className="px-4 py-3 font-semibold">Blocked</th>
              <th className="px-4 py-3 font-semibold">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-gray-500">No summary rows.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.fellow_id ?? "unassigned"} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-950">{row.fellow_id ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-gray-700">{row.done}</td>
                <td className="px-4 py-3 text-gray-700">{row.pending}</td>
                <td className="px-4 py-3 text-gray-700">{row.blocked}</td>
                <td className="px-4 py-3 text-gray-700">{row.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "gray" | "red" | "amber" }) {
  const toneClass = {
    green: "text-emerald-700",
    gray: "text-gray-700",
    red: "text-red-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
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

function TabIcon({ tab }: { tab: TrackerTab }) {
  const props = { className: "h-4 w-4", "aria-hidden": true };
  if (tab === "tasks") return <ClipboardList {...props} />;
  if (tab === "myTasks") return <Table2 {...props} />;
  if (tab === "blockers") return <AlertCircle {...props} />;
  if (tab === "summary") return <ShieldCheck {...props} />;
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
