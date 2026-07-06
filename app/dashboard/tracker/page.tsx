"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  PencilRuler,
  Send,
  Table2,
  X,
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
  useTrackerTemplates,
} from "@/lib/queries/tracker";
import type { TrackerBlocker, TrackerEvent, TrackerGrid, TrackerTemplate } from "@/lib/tracker-api";
import { TrackerBuilder } from "./_components/tracker-builder";
import { TrackerEditableGrid } from "./_components/tracker-grid";
import { TaskDetail } from "./_components/task-detail";
import { MyTasksList, TaskListView } from "./_components/my-tasks";
import PushNudge from "@/components/PushNudge";

type TrackerTab = "myTasks" | "blockers" | "builder";

const tabLabels: Record<TrackerTab, string> = {
  myTasks: "Tasks",
  blockers: "Blockers",
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
    if (canFill || isManagerView) next.push("myTasks");   // own task list — fellows + managers
    next.push("blockers");
    if (canAuthor) next.push("builder");                   // new + manage templates
    return next;
  }, [canAuthor, canFill, isManagerView]);

  const [activeTab, setActiveTab] = useState<TrackerTab>("myTasks");
  const [fillTemplateId, setFillTemplateId] = useState<string | null>(null);
  const safeActiveTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  const { data: templates = [], error: templatesError } = useTrackerTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null;
  const templateId = selectedTemplate?.id;

  const grid = useTrackerGrid(templateId);
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Hub Module</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-950">Tracker</h1>
          <p className="mt-2 text-sm text-gray-500">
            {currentUser?.role.name ?? "Team"} workspace
          </p>
        </div>
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
      ) : safeActiveTab === "myTasks" ? (
        fillTemplateId ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setFillTemplateId(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my tasks
            </button>
            <GridPanel template={templates.find((t) => t.id === fillTemplateId) ?? null} grid={grid.data} loading={grid.isLoading} error={grid.error} canFill={canFill} canClear={canClear} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <OverviewStrip />
            {canAuthor ? (
              <TeamPanel onOpen={(tid) => { setSelectedTemplateId(tid); setFillTemplateId(tid); }} />
            ) : (
              <MyTasksList onOpen={(tid) => { setSelectedTemplateId(tid); setFillTemplateId(tid); }} />
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
      ) : (
        <NewTaskPanel canAuthor={canAuthor} canFill={canFill} canClear={canClear} />
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
    return <EmptyPanel title="No templates yet" detail="Create your first one in the “New task” tab, then assign it to fellows, schools, or students." />;
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

function TeamPanel({ onOpen }: { onOpen: (templateId: string) => void }) {
  const { data: fellows = [], isLoading } = useTrackerFellows();
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [q, setQ] = useState("");
  const tasks = useTrackerFellowTasks(sel?.id);

  if (sel) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to fellows
        </button>
        <h3 className="text-sm font-semibold text-gray-950">{sel.name}&apos;s tasks</h3>
        {tasks.isLoading ? <TrackerLoading /> : <TaskListView tasks={tasks.data ?? []} onOpen={onOpen} emptyTitle="No tasks" emptyDetail={`${sel.name} has no tasks yet.`} />}
      </div>
    );
  }

  if (isLoading) return <TrackerLoading />;
  if (fellows.length === 0) return <EmptyPanel title="No fellows" detail="Fellows you manage will appear here." />;

  const shown = fellows.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-gray-950">Your fellows</h3>
          <p className="mt-0.5 text-xs text-gray-500">Open a fellow to see their tasks.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fellows…" className="h-9 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500" />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-500">No fellows match “{q}”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setSel({ id: f.id, name: f.name })}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-teal-50"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                    {f.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span className="truncate">{f.name}</span>
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewTaskPanel({ canAuthor, canFill, canClear }: { canAuthor: boolean; canFill: boolean; canClear: boolean }) {
  const [mode, setMode] = useState<"template" | "scratch">("template");
  const { data: templates = [], isLoading } = useTrackerTemplates();
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
  if (detailId && templates.some((t) => t.id === detailId)) {
    return (
      <TaskDetail
        template={templates.find((t) => t.id === detailId)!}
        canAuthor={canAuthor}
        onBack={() => setDetailId(null)}
        onOpenGrid={() => setGridId(detailId)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
        <button type="button" onClick={() => setMode("template")} className={tabCls(mode === "template")}>Use existing</button>
        <button type="button" onClick={() => setMode("scratch")} className={tabCls(mode === "scratch")}>Create new</button>
      </div>
      {mode === "template"
        ? <TasksPanel templates={templates} loading={isLoading} selectedId={undefined} onSelect={(id) => setDetailId(id)} />
        : <TrackerBuilder canAuthor={canAuthor} />}
    </div>
  );
}

function OverviewStrip() {
  const overview = useTrackerOverview();
  const t = overview.data?.totals;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <OverviewMetric label="Done" value={t?.done} tone="text-emerald-700" />
      <OverviewMetric label="Pending" value={t?.pending} tone="text-gray-700" />
      <OverviewMetric label="Blocked" value={t?.blocked} tone="text-red-700" />
      <OverviewMetric label="Overdue" value={t?.overdue} tone="text-amber-700" />
    </section>
  );
}

function OverviewMetric({ label, value, tone }: { label: string; value: number | undefined; tone: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value ?? "—"}</p>
    </div>
  );
}

function GridPanel({
  template,
  grid,
  loading,
  error,
  canFill,
  canClear,
}: {
  template: TrackerTemplate | null;
  grid: TrackerGrid | undefined;
  loading: boolean;
  error: unknown;
  canFill: boolean;
  canClear: boolean;
}) {
  if (!template) return <EmptyPanel title="No task selected" detail="Choose a task type to view rows." />;
  if (loading) return <TrackerLoading />;
  if (error) return <ErrorPanel message={error instanceof Error ? error.message : "Failed to load grid."} />;
  if (!grid || grid.rows.length === 0) return <EmptyPanel title="No rows" detail="Assigned rows will appear here." />;

  return <TrackerEditableGrid template={template} grid={grid} canFill={canFill} canClear={canClear} />;
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
        <BlockerList title="Raised by me" subtitle="Blockers you flagged that are still open." blockers={mine} loading={mineLoading} error={mineError} canClear={canClear} onOpen={setOpenId} />
        {isManagerView && (
          <BlockerList title="Needs my attention" subtitle="Blockers escalated up to you, awaiting a response." blockers={queue} loading={queueLoading} error={queueError} canClear={canClear} onOpen={setOpenId} />
        )}
      </div>
      {openId && <BlockerDrawer blockerId={openId} canClear={canClear} onClose={() => setOpenId(null)} />}
    </>
  );
}

function BlockerList({
  title,
  subtitle,
  blockers,
  loading,
  error,
  canClear,
  onOpen,
}: {
  title: string;
  subtitle: string;
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
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
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
    case "blocker_escalated": return `Escalated to ${roleLabel(String(d.to_role ?? ""))}`;
    case "blocker_cleared": return "Blocker cleared";
    default: return ev.event_type;
  }
}

function roleLabel(code: string): string {
  if (code === "ZONAL_MANAGER") return "Zonal Manager";
  if (code === "PROGRAM_MANAGER") return "Program Manager";
  return code || "manager";
}

function TabIcon({ tab }: { tab: TrackerTab }) {
  const props = { className: "h-4 w-4", "aria-hidden": true };
  if (tab === "myTasks") return <Table2 {...props} />;
  if (tab === "blockers") return <AlertCircle {...props} />;
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
