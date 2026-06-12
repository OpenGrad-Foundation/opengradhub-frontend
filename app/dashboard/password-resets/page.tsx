"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  getPasswordResetRequests,
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
  type PasswordResetRequest,
} from "@/lib/api";

export default function PasswordResetsPage() {
  const { isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permissionsLoading } = usePermissions();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const isAuthLoading = userLoading || permissionsLoading;
  const canView = has(PERM.user_management.password_reset_view);
  const canManage = has(PERM.user_management.password_reset_manage);

  const load = useCallback(() => {
    setLoading(true);
    getPasswordResetRequests()
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAuthLoading || !canView) return;
    load();
  }, [isAuthLoading, canView, load]);

  async function handle(action: "approve" | "reject", req: PasswordResetRequest) {
    setActionId(req.id);
    setError(null);
    setNotice(null);
    try {
      if (action === "approve") {
        await approvePasswordResetRequest(req.id, newPassword);
        setNotice(
          `Approved. Share the new password with ${req.student_name} offline — they sign in with their roll number and this password.`,
        );
        setApprovingId(null);
        setNewPassword("");
      } else {
        await rejectPasswordResetRequest(req.id);
        setNotice(`Rejected request from ${req.student_name}.`);
      }
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionId(null);
    }
  }

  if (isAuthLoading) return null;
  if (!canView) {
    return (
      <div className="p-8 text-sm text-black/70">
        You do not have access to password reset requests.
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl">
      <h1 className="text-xl font-bold mb-1">Password Reset Requests</h1>
      <p className="text-sm text-black/60 mb-6">
        Students who forgot their password and verified their roll number and date of
        birth. Approve a request by setting a new password for the student, then share
        it with them offline.
      </p>

      {notice && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-black/60">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-black/60">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {req.student_name}{" "}
                  <span className="font-normal text-zinc-500">({req.roll_number})</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {req.school_name ?? "No school"} ·{" "}
                  {new Date(req.created_at).toLocaleString()}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-center">
                  {approvingId === req.id ? (
                    <>
                      <input
                        type="text"
                        placeholder="New password (min 8 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={actionId === req.id || newPassword.length < 8}
                        onClick={() => handle("approve", req)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                      >
                        Set password
                      </button>
                      <button
                        type="button"
                        onClick={() => { setApprovingId(null); setNewPassword(""); }}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={actionId === req.id}
                        onClick={() => { setApprovingId(req.id); setNewPassword(""); }}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionId === req.id}
                        onClick={() => handle("reject", req)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
