"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Mirrors the signed-in user into the Sentry scope so error events and
 * bug-report feedback carry verified identity (the feedback form's typed
 * name/email fields are hidden — this is the only identity source).
 */
export default function SentryUserSync() {
  const { data } = useCurrentUser();

  useEffect(() => {
    if (data?.user) {
      Sentry.setUser({
        id: data.user.id,
        email: data.user.email ?? undefined,
        username: data.user.fullName,
      });
      Sentry.setTag("role", data.role?.code ?? "unknown");
    } else {
      Sentry.setUser(null);
    }
  }, [data]);

  return null;
}
