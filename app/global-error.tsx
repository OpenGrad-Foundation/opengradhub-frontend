"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[var(--color-ink)] px-6 py-12 text-white">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/8 p-8 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-sun)]">
            OpenGradHub
          </p>
          <h1 className="mt-4 text-3xl font-semibold">
            Something went wrong
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/72">
            The error has been reported to Sentry. You can try rendering the page
            again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-2xl bg-[var(--color-deep-teal)] px-5 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
