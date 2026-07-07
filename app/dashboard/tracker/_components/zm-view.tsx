"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTrackerZms, useTrackerZmFellows, useTrackerFellowTasks } from "@/lib/queries/tracker";
import { TaskListView } from "./my-tasks";

function Loading() {
  return <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>;
}

export function ZmView({ onOpen }: { onOpen: (templateId: string, ownerId: string) => void }) {
  const { data: zms = [], isLoading } = useTrackerZms();
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [q, setQ] = useState("");

  if (sel) return <ZmDetail zm={sel} onBack={() => setSel(null)} onOpen={onOpen} />;
  if (isLoading) return <Loading />;
  if (zms.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-5 text-center">
        <p className="text-sm font-semibold text-gray-950">No zonal managers</p>
        <p className="text-sm text-gray-500">ZMs you manage will appear here.</p>
      </div>
    );
  }
  const shown = zms.filter((z) => z.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-gray-950">Your zonal managers</h3>
          <p className="mt-0.5 text-xs text-gray-500">Open a ZM to see their own tasks and their fellows.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ZMs…" className="h-9 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500" />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-500">No ZMs match “{q}”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((z) => (
            <li key={z.id}>
              <button type="button" onClick={() => setSel({ id: z.id, name: z.name })}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-teal-50">
                <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                    {z.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span className="truncate">{z.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden items-center gap-2 text-xs sm:flex">
                    <span className="text-gray-500">{z.fellow_count} fellows</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-semibold text-emerald-700">{z.own_done} done</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-semibold text-amber-700">{z.own_pending} left</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition group-hover:bg-teal-100">
                    Open <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
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

function ZmDetail({ zm, onBack, onOpen }: { zm: { id: string; name: string }; onBack: () => void; onOpen: (templateId: string, ownerId: string) => void }) {
  const own = useTrackerFellowTasks(zm.id);
  const fellows = useTrackerZmFellows(zm.id);
  const [fellow, setFellow] = useState<{ id: string; name: string } | null>(null);
  const fellowTasks = useTrackerFellowTasks(fellow?.id);

  if (fellow) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setFellow(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {zm.name}
        </button>
        <h3 className="text-sm font-semibold text-gray-950">{fellow.name}&apos;s tasks</h3>
        {fellowTasks.isLoading ? <Loading /> : <TaskListView tasks={fellowTasks.data ?? []} onOpen={(tid) => onOpen(tid, fellow.id)} emptyTitle="No tasks" emptyDetail={`${fellow.name} has no tasks yet.`} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to zonal managers
      </button>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-950">{zm.name}&apos;s own tasks</h3>
        {own.isLoading ? <Loading /> : <TaskListView tasks={own.data ?? []} onOpen={(tid) => onOpen(tid, zm.id)} emptyTitle="No tasks" emptyDetail={`${zm.name} has no tasks assigned directly.`} />}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-950">Fellows under {zm.name}</h3>
        {fellows.isLoading ? <Loading /> : (fellows.data ?? []).length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">No fellows under this ZM.</p>
        ) : (
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {(fellows.data ?? []).map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setFellow({ id: f.id, name: f.name })}
                    className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-teal-50">
                    <span className="truncate font-medium text-gray-900">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="hidden items-center gap-2 text-xs sm:flex">
                        <span className="font-semibold text-emerald-700">{f.done} done</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500">{f.total} assigned</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
