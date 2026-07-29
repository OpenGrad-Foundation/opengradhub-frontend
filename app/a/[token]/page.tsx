"use client";

/**
 * Public school attendance page — opened from a WhatsApp-shared link.
 * No login, no dashboard chrome; must work on cheap phones. One big button.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getPublicAttendance,
  markPublicAttendance,
  type PublicLinkView,
} from "@/lib/attendance-api";

type State =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "ready"; view: PublicLinkView; marking: boolean; markError: string | null };

export default function PublicAttendancePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async () => {
    try {
      const view = await getPublicAttendance(token);
      setState({ phase: "ready", view, marking: false, markError: null });
    } catch {
      setState({ phase: "not-found" });
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const mark = async () => {
    if (state.phase !== "ready") return;
    setState({ ...state, marking: true, markError: null });
    try {
      await markPublicAttendance(token);
      setState({
        phase: "ready",
        view: { ...state.view, attended: true },
        marking: false,
        markError: null,
      });
    } catch {
      setState({
        ...state,
        marking: false,
        markError: "Could not mark attendance. Please try again.",
      });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)] mb-4">
          OpenGrad · Live Class Attendance
        </p>

        {state.phase === "loading" && (
          <p className="py-10 text-slate-500">Loading…</p>
        )}

        {state.phase === "not-found" && (
          <div className="py-10">
            <p className="text-lg font-semibold text-[var(--dark-teal)]">Link invalid</p>
            <p className="mt-2 text-sm text-slate-500">
              This attendance link is not valid. Please ask your OpenGrad fellow for a new one.
            </p>
          </div>
        )}

        {state.phase === "ready" && (
          <>
            <h1 className="text-xl font-bold text-[var(--dark-teal)]">{state.view.class_title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {new Date(state.view.scheduled_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              {state.view.duration_minutes} min
            </p>
            <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {state.view.school_name}
            </p>

            {state.view.attended ? (
              <div className="mt-8 rounded-xl bg-green-50 border border-green-200 p-6">
                <p className="text-3xl">✓</p>
                <p className="mt-2 text-lg font-semibold text-green-800">Marked — thank you!</p>
                <p className="mt-1 text-sm text-green-700">
                  Your school&apos;s attendance for this class is recorded.
                </p>
              </div>
            ) : state.view.window_open ? (
              <div className="mt-8">
                <button
                  onClick={mark}
                  disabled={state.marking}
                  className="w-full rounded-xl px-6 py-4 text-lg font-semibold text-white bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.25)] active:scale-[0.99] disabled:opacity-60"
                >
                  {state.marking ? "Marking…" : "Mark our school present"}
                </button>
                {state.markError && (
                  <p className="mt-3 text-sm text-red-600">{state.markError}</p>
                )}
              </div>
            ) : (
              <div className="mt-8 rounded-xl bg-amber-50 border border-amber-200 p-6">
                <p className="text-lg font-semibold text-amber-800">Marking closed</p>
                <p className="mt-1 text-sm text-amber-700">
                  The marking window for this class is not open. Contact your OpenGrad fellow if
                  this is a mistake.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
