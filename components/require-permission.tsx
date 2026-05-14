"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permission";
import { ROUTE_PERMISSION } from "@/lib/permissions";

// ── Reusable wrapper ─────────────────────────────────────────────────────────
// Gates a subtree behind one or more permission codes (ANY-of). While the
// profile is still loading we render nothing rather than flash the deny state.

export function RequirePermission({
  perm,
  children,
  fallback,
}: {
  perm: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasAny, isLoading } = usePermissions();
  const codes = Array.isArray(perm) ? perm : [perm];

  if (isLoading) return null;
  if (!hasAny(...codes)) return <>{fallback ?? <NoAccess />}</>;
  return <>{children}</>;
}

// ── Route-level guard ────────────────────────────────────────────────────────
// Mounted once in DashboardShell. Maps the first path segment under /dashboard
// to a permission via ROUTE_PERMISSION; if the caller lacks it, bounce to their
// home dashboard. Segments not in the map (e.g. /dashboard itself, self-scoped
// pages) are always allowed. This is a UX guard — the backend still enforces.

export function DashboardRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { has, isLoading } = usePermissions();

  const segment = pathname.replace(/^\/dashboard\/?/, "").split("/")[0] ?? "";
  const required = ROUTE_PERMISSION[segment];
  const allowed = !required || has(required);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace("/dashboard");
    }
  }, [isLoading, allowed, router]);

  if (!isLoading && !allowed) return <NoAccess />;
  return <>{children}</>;
}

// ── Deny state ───────────────────────────────────────────────────────────────

function NoAccess() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="h-10 w-10 text-gray-400" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-gray-900">No access</h2>
      <p className="max-w-sm text-sm text-gray-500">
        You don&apos;t have permission to view this page. If you think this is a
        mistake, ask your administrator to grant the required permission.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--dark-teal)]"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
