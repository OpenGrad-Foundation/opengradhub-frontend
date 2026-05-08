"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function DashboardEntryPage() {
  const router = useRouter();
  const { data, error, isLoading } = useCurrentUser();

  useEffect(() => {
    if (data) {
      router.replace(data.role.dashboardPath);
    }
  }, [data, router]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] px-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/12 bg-white/6 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-sun)]">
            Redirecting
          </p>
          <h1 className="font-display mt-4 text-3xl font-semibold">
            Finding your dashboard
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Matching the signed-in user to the correct OpenGradHub workspace.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] px-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-[var(--color-sun)]/30 bg-[var(--color-deep-teal)] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-sun)]">
            Dashboard redirect failed
          </p>
          <h1 className="font-display mt-4 text-3xl font-semibold">
            We could not route this account
          </h1>
          <p className="mt-3 text-sm text-white/75">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-6 rounded-2xl bg-[var(--color-sun)] px-5 py-3 text-sm font-semibold text-[var(--color-deep-teal)]"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return null;
}
