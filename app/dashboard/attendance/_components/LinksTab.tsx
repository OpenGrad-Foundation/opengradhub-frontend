"use client";

/**
 * Stream 1 staff view: per-class school links — share on WhatsApp, copy,
 * override, add/remove schools, re-sync from targeting.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLiveClasses } from "@/lib/queries/live-classes";
import {
  useClassLinks,
  useGenerateLinks,
  useAddSchoolLink,
  useRemoveLink,
  useOverrideLink,
  useRegenerateLink,
} from "@/lib/queries/attendance";
import { useQuery } from "@tanstack/react-query";
import { fetchSchools } from "@/lib/api";
import type { LinkRow } from "@/lib/attendance-api";

function publicUrl(token: string): string {
  return `${window.location.origin}/a/${token}`;
}

function waShareHref(link: LinkRow, classTitle: string, scheduledAt: string): string {
  const when = new Date(scheduledAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const msg = `Attendance link for "${classTitle}" (${when}) — ${link.school_name}:\n${publicUrl(link.token)}\n\nOpen the link and tap "Mark our school present" after the class.`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function ClassLinksPanel({ classId, classTitle, scheduledAt, canManage }: {
  classId: string;
  classTitle: string;
  scheduledAt: string;
  canManage: boolean;
}) {
  const { data: links, isLoading } = useClassLinks(classId);
  const generate = useGenerateLinks();
  const addSchool = useAddSchoolLink();
  const removeLink = useRemoveLink();
  const override = useOverrideLink();
  const regenerate = useRegenerateLink();
  const [addingSchool, setAddingSchool] = useState("");

  const { data: schools } = useQuery({
    queryKey: ["og", "schools", "options"],
    queryFn: fetchSchools,
    staleTime: 5 * 60_000,
    enabled: canManage,
  });

  const linkedIds = useMemo(() => new Set((links ?? []).map((l) => l.school_id)), [links]);
  const addable = (schools ?? []).filter((s) => !linkedIds.has(s.id));

  if (isLoading) return <p className="p-3 text-sm text-slate-500">Loading links…</p>;

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2">
      {(links ?? []).length === 0 && (
        <p className="text-sm text-slate-500">No schools linked to this class yet.</p>
      )}
      {(links ?? []).map((link) => (
        <div key={link.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
          <span className="font-medium text-sm text-slate-800">{link.school_name}</span>
          {link.origin === "MANUAL" && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">MANUAL</span>
          )}
          {link.attended_at ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              Marked ✓ {link.attended_via === "STAFF" ? "(staff)" : "(link)"}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              Not marked
            </span>
          )}
          <span className="flex-1" />
          <a
            href={waShareHref(link, classTitle, scheduledAt)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
          >
            WhatsApp
          </a>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(publicUrl(link.token));
              toast.success("Link copied");
            }}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Copy link
          </button>
          {canManage && (
            <>
              <button
                onClick={() =>
                  override.mutate(
                    { linkId: link.id, attended: !link.attended_at },
                    { onError: (e) => toast.error(e.message) },
                  )
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {link.attended_at ? "Unmark" : "Mark present"}
              </button>
              <button
                onClick={() =>
                  regenerate.mutate(link.id, {
                    onSuccess: () => toast.success("Token regenerated — old link is dead"),
                    onError: (e) => toast.error(e.message),
                  })
                }
                title="Rotate the public token (use if the link leaked)"
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Regenerate
              </button>
              <button
                onClick={() =>
                  removeLink.mutate(link.id, { onError: (e) => toast.error(e.message) })
                }
                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </>
          )}
        </div>
      ))}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={addingSchool}
            onChange={(e) => setAddingSchool(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="">Add school…</option>
            {addable.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            disabled={!addingSchool || addSchool.isPending}
            onClick={() =>
              addSchool.mutate(
                { classId, schoolId: addingSchool },
                {
                  onSuccess: () => setAddingSchool(""),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add
          </button>
          <span className="flex-1" />
          <button
            disabled={generate.isPending}
            onClick={() =>
              generate.mutate(classId, {
                onSuccess: (r) => toast.success(`Re-synced: +${r.added} / −${r.removed}`),
                onError: (e) => toast.error(e.message),
              })
            }
            className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Re-sync from targeting
          </button>
        </div>
      )}
    </div>
  );
}

export function LinksTab({ canManage }: { canManage: boolean }) {
  const { data: classes, isLoading } = useLiveClasses();
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = [...(classes ?? [])];
    // Upcoming first (soonest at top), then past classes newest-first.
    const now = Date.now();
    return list.sort((a, b) => {
      const at = new Date(a.scheduled_at).getTime();
      const bt = new Date(b.scheduled_at).getTime();
      const aUp = at >= now, bUp = bt >= now;
      if (aUp !== bUp) return aUp ? -1 : 1;
      return aUp ? at - bt : bt - at;
    });
  }, [classes]);

  if (isLoading) return <p className="text-slate-500">Loading live classes…</p>;
  if (sorted.length === 0) return <p className="text-slate-500">No live classes yet.</p>;

  return (
    <div className="space-y-2">
      {sorted.map((cls) => (
        <div key={cls.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            onClick={() => setOpenId(openId === cls.id ? null : cls.id)}
            className="w-full flex flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="font-semibold text-slate-800">{cls.title}</span>
            <span className="text-sm text-slate-500">
              {new Date(cls.scheduled_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            <span className="flex-1" />
            <span className="text-xs text-slate-400">{openId === cls.id ? "▲" : "▼"}</span>
          </button>
          {openId === cls.id && (
            <ClassLinksPanel
              classId={cls.id}
              classTitle={cls.title}
              scheduledAt={cls.scheduled_at}
              canManage={canManage}
            />
          )}
        </div>
      ))}
    </div>
  );
}
