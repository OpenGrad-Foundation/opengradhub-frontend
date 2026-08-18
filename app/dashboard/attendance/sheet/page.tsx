"use client";

// The printable sheet moved OUT of the dashboard layout (its chrome printed as
// blank pages). This stub keeps old bookmarks working.
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams, notFound } from "next/navigation";

function Redirector() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    router.replace(`/print/register?${params.toString()}`);
  }, [router, params]);
  return <p className="p-6 text-sm text-slate-500">Opening printable sheet…</p>;
}

// Retained (not deleted) so re-enabling the feature is a one-line revert.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacySheetRedirect() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}

// ── Attendance registers / OMR: hidden, not removed ──────────────────────────
// This feature rode along with the FellowTracker release (its commits interleave
// with the tracker ones) but is not meant to be exposed yet. The route is closed
// here rather than deleted so turning it back on is a one-line revert.
//
// Presentation only: the backend module and its endpoints still answer. This is
// a "not finished, don't show it" switch, NOT access control.
// See HIDDEN_MODULE_KEYS in lib/moduleAccess.ts.
export default function LegacySheetRedirectHidden() {
  notFound();
}
