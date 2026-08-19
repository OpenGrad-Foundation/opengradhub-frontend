"use client";

// The printable sheet moved OUT of the dashboard layout (its chrome printed as
// blank pages). This stub keeps old bookmarks working.
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirector() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    router.replace(`/print/register?${params.toString()}`);
  }, [router, params]);
  return <p className="p-6 text-sm text-slate-500">Opening printable sheet…</p>;
}

export default function LegacySheetRedirect() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
