"use client";

import Link from "next/link";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { useAnyPermission, usePermissions } from "@/hooks/use-permission";
import { withFrom } from "@/lib/nav";

/**
 * A link from a programme-hub table row to that entity's own page.
 *
 * Three things it does that a bare <Link> would not:
 *
 * 1. **Checks the permission the destination actually requires.** The hub lists
 *    schools, batches, students and content to any member, but those detail
 *    pages are separately gated — DashboardRouteGuard bounces a caller who lacks
 *    the permission. Rendering a link that leads to a bounce is worse than plain
 *    text, so a caller who cannot open the page gets the name, unlinked.
 *
 * 2. **Carries `?from=`**, so the destination's back button returns to this
 *    programme tab rather than the entity's own generic parent. That is the
 *    convention in lib/nav.ts, not an invention here.
 *
 * 3. **Keeps one rule in one place.** Six tables link out; without this each one
 *    would re-decide the permission and the back-link, and they would drift.
 */
export function EntityLink({
  href,
  permissions,
  requiredPermissions = [],
  style,
  children,
}: {
  href: string;
  /** Any one of these is enough — mirrors ROUTE_PERMISSION, which is ANY-of. */
  permissions: readonly string[];
  requiredPermissions?: readonly string[];
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const allowed = useAnyPermission(...permissions);
  const { has } = usePermissions();
  const current = useCurrentUrl();

  if (!allowed || !requiredPermissions.every(has)) return <>{children}</>;

  return (
    <Link
      href={withFrom(href, current)}
      style={{ color: "#0abe62", fontWeight: 600, textDecoration: "none", ...style }}
    >
      {children}
    </Link>
  );
}
