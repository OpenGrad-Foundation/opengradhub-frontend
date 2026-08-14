/** Notification type → destination route for clickable notifications. */
export const NOTIFICATION_ROUTES: Record<string, string> = {
  PASSWORD_RESET_REQUESTED: "/dashboard/password-resets",
  ATTEMPT_RESET: "/dashboard/assessments",
  // The per-row `link` carries ?question=<id>; this is only the fallback.
  QUESTION_REPORTED: "/dashboard/test-bank",
};

/** Only same-origin app paths are safe to router.push — reject absolute URLs and
 *  protocol-relative ("//host") links so a tainted persisted link can't navigate away. */
export function safeInternalPath(link: string | null | undefined): string | undefined {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return undefined;
  return link;
}

/** The destination for a clickable notification: its persisted deep link (if a
 *  safe internal path), else the static type→route fallback. */
export function notificationRoute(type: string, link: string | null | undefined): string | undefined {
  return safeInternalPath(link) ?? NOTIFICATION_ROUTES[type];
}
