"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryExamplePage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-ink)] px-6 py-12 text-white">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/8 p-8 text-center backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-sun)]">
          Sentry Test
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Verify frontend reporting</h1>
        <p className="mt-4 text-sm leading-7 text-white/72">
          Send a sample event directly to Sentry, then optionally trigger a thrown
          browser error as a second check.
        </p>
        <button
          type="button"
          onClick={async () => {
            const sentryEventId = Sentry.captureException(
              new Error("This is a test error from /sentry-example-page"),
            );

            setEventId(sentryEventId);
            setSendStatus("Sending event to Sentry...");

            const flushed = await Sentry.flush(2000);
            setSendStatus(
              flushed
                ? "The browser SDK flushed the event successfully."
                : "The browser SDK timed out while flushing the event.",
            );
          }}
          className="mt-8 rounded-2xl bg-[var(--color-sun)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)]"
        >
          Send Sample Event
        </button>
        <button
          type="button"
          onClick={() => {
            throw new Error("This is a thrown browser error from /sentry-example-page");
          }}
          className="mt-4 rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white"
        >
          Throw Browser Error
        </button>
        {eventId ? (
          <p className="mt-6 text-sm leading-7 text-white/72">
            Sent event to Sentry with event ID: <span className="font-mono">{eventId}</span>
          </p>
        ) : null}
        {sendStatus ? (
          <p className="mt-3 text-sm leading-7 text-white/72">{sendStatus}</p>
        ) : null}
      </div>
    </main>
  );
}
