"use client";

/**
 * School confirmations: a per-class public link a school opens to say "our
 * school attended". Whole-school and nothing more — it never marks an
 * individual student and never competes with the register.
 *
 * Renamed from "Live Classes", which read as if this tab were the live-class
 * attendance surface. It is not: individual attendance lives in Records.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLiveClasses } from "@/lib/queries/live-classes";
import {
  useClassLinks,
  useGenerateLinks,
  useAddSchoolLinks,
  useRemoveLink,
  useOverrideLink,
  useRegenerateLink,
} from "@/lib/queries/attendance";
import { useQuery } from "@tanstack/react-query";
import { fetchSchools, getCourses, type Course } from "@/lib/api";
import { useBatches } from "@/lib/queries/batches";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";
import { SchoolMultiPicker } from "@/components/SchoolMultiPicker";
import type { LinkRow } from "@/lib/attendance-api";

/** House primary button — mirrors the gradient CTA used across the dashboard. */
const PRIMARY_BTN =
  "rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 " +
  "bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]";

const SECONDARY_BTN =
  "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium " +
  "text-[var(--dark-teal)] hover:bg-[var(--color-mint-soft)]";

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
  const addSchools = useAddSchoolLinks();
  const removeLink = useRemoveLink();
  const override = useOverrideLink();
  const regenerate = useRegenerateLink();
  const [addingIds, setAddingIds] = useState<string[]>([]);

  const { data: schools, isError: schoolsFailed, isLoading: schoolsLoading } = useQuery({
    queryKey: ["og", "schools", "options"],
    queryFn: fetchSchools,
    staleTime: 5 * 60_000,
    enabled: canManage,
  });

  // Already-linked schools stay in the list but are disabled, rather than being
  // filtered out — filtering would drop a chip from the selection if someone
  // else linked that school between renders.
  const linkedIds = useMemo(() => (links ?? []).map((l) => l.school_id), [links]);

  if (isLoading) return <p className="p-3 text-sm text-slate-500">Loading links…</p>;

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2">
      {(links ?? []).length === 0 && (
        <p className="text-sm text-slate-500">No schools linked to this class yet.</p>
      )}
      {(links ?? []).map((link) => (
        <div key={link.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
          <span className="font-medium text-sm text-[var(--dark-teal)]">{link.school_name}</span>
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
        <div className="pt-1 space-y-2">
          {schoolsFailed ? (
            <p className="text-sm text-red-600">
              Can&apos;t load the school list — your role may not have permission to view schools.
              Ask an admin.
            </p>
          ) : (
            <SchoolMultiPicker
              schools={schools ?? []}
              value={addingIds}
              onChange={setAddingIds}
              disabledIds={linkedIds}
              isLoading={schoolsLoading}
              placeholder="Add schools — search by name, code or district…"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={addingIds.length === 0 || addSchools.isPending}
              onClick={() =>
                addSchools.mutate(
                  { classId, schoolIds: addingIds },
                  {
                    onSuccess: ({ linked, failed }) => {
                      if (failed.length === 0) {
                        toast.success(`Added ${linked} school${linked === 1 ? "" : "s"}`);
                        setAddingIds([]);
                      } else {
                        toast.error(`${linked} added, ${failed.length} failed — ${failed[0].message}`);
                        // Keep only what still needs attention selected.
                        setAddingIds(failed.map((f) => f.id));
                      }
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
              className={PRIMARY_BTN}
            >
              {addSchools.isPending ? "Adding…" : `Add${addingIds.length ? ` (${addingIds.length})` : ""}`}
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
              className={SECONDARY_BTN}
            >
              Re-sync from targeting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Course / batch / programme, the three ways a live class declares who it is
 * for. Filtering happens over the rows already on the client, so this costs no
 * request — the school set for each class is what is loaded lazily, per row.
 */
function AudienceFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    let cancelled = false;
    getCourses(undefined, undefined, undefined, true)
      .then((cs) => { if (!cancelled) setCourses(cs); })
      .catch(() => { /* the picker just stays short; the list still works */ });
    return () => { cancelled = true; };
  }, []);
  const batches = useBatches();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Audience"
      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--dark-teal)] min-w-[200px]"
    >
      <option value="">All audiences</option>
      <optgroup label="Courses">
        {courses.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.title}</option>)}
      </optgroup>
      <optgroup label="Batches">
        {(batches.data ?? []).map((b) => <option key={b.id} value={`batch:${b.id}`}>{b.name}</option>)}
      </optgroup>
      <optgroup label="Programmes">
        {PROGRAMME_KINDS.map((k) => <option key={k.value} value={`programme:${k.value}`}>{k.label}</option>)}
      </optgroup>
    </select>
  );
}

export function SchoolConfirmationsTab({ canManage }: { canManage: boolean }) {
  const { data: classes, isLoading } = useLiveClasses();
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "upcoming" | "past">("all");
  // `course:<id>` | `batch:<id>` | `programme:<kind>` — the three ways a class
  // declares its audience, all already present on the rows this tab fetched.
  const [audience, setAudience] = useState("");

  // Read the clock once per mount instead of on every render: reading it during
  // render is impure (React 19 lint) and would let the upcoming/past split shift
  // under the user mid-session.
  const [now] = useState(() => Date.now());

  const sorted = useMemo(() => {
    // Filtered client-side over the list this tab already fetches: the school
    // set for a class is loaded lazily per row, so a server round-trip would
    // buy nothing here.
    const needle = q.trim().toLowerCase();
    const list = (classes ?? []).filter((c) => {
      if (needle && !c.title.toLowerCase().includes(needle)) return false;

      if (audience) {
        const [kind, id] = audience.split(":");
        const matches =
          kind === "course" ? c.course_id === id
          : kind === "batch" ? (c.batch_ids ?? []).includes(id)
          : kind === "programme" ? c.programme_type === id
          : true;
        if (!matches) return false;
      }

      if (view === "all") return true;
      const ended = new Date(c.scheduled_at).getTime()
        + c.duration_minutes * 60_000 <= now;
      return view === "past" ? ended : !ended;
    });
    // Upcoming first (soonest at top), then past classes newest-first.
    return list.sort((a, b) => {
      const at = new Date(a.scheduled_at).getTime();
      const bt = new Date(b.scheduled_at).getTime();
      const aUp = at >= now, bUp = bt >= now;
      if (aUp !== bUp) return aUp ? -1 : 1;
      return aUp ? at - bt : bt - at;
    });
  }, [classes, now, q, view, audience]);

  if (isLoading) return <p className="text-slate-500">Loading live classes…</p>;

  const total = classes?.length ?? 0;

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        A whole-school confirmation for a live class. This does not mark individual
        students — their attendance is in <b>Records</b>.
      </p>

      <div className="flex flex-wrap items-center gap-2 pb-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search class titles…"
          aria-label="Search class titles"
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--dark-teal)] min-w-[200px]"
        />
        <div className="flex gap-1" role="group" aria-label="Time filter">
          {(["all", "upcoming", "past"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize " +
                (view === v
                  ? "text-white bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)]"
                  : "border border-[var(--color-border)] text-[var(--dark-teal)]")
              }
            >
              {v}
            </button>
          ))}
        </div>
        <AudienceFilter value={audience} onChange={setAudience} />
        {sorted.length !== total && (
          <span className="text-xs text-slate-500">{sorted.length} of {total}</span>
        )}
      </div>

      {sorted.length === 0 && (
        <p className="text-slate-500">
          {total === 0 ? "No live classes yet." : "No classes match these filters."}
        </p>
      )}

      {sorted.map((cls) => (
        <div key={cls.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            onClick={() => setOpenId(openId === cls.id ? null : cls.id)}
            className="w-full flex flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="font-semibold text-[var(--dark-teal)]" style={{ fontFamily: "var(--font-heading)" }}>
              {cls.title}
            </span>
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
