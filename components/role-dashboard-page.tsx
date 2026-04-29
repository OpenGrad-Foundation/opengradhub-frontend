"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { roleCodeBySlug } from "@/lib/role-dashboard";

type RoleDashboardPageProps = {
  roleSlug: keyof typeof roleCodeBySlug;
};

export function RoleDashboardPage({ roleSlug }: RoleDashboardPageProps) {
  const router = useRouter();
  const { data, error, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.role.dashboardPath !== `/dashboard/${roleSlug}`) {
      router.replace(data.role.dashboardPath);
    }
  }, [data, roleSlug, router]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] px-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/12 bg-white/6 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-sun)]">
            Loading
          </p>
          <h1 className="font-display mt-4 text-3xl font-semibold">
            Preparing your dashboard
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Fetching your local OpenGradHub profile and permissions.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] px-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-[var(--color-sun)]/30 bg-[var(--color-deep-teal)] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-sun)]">
            Dashboard unavailable
          </p>
          <h1 className="font-display mt-4 text-3xl font-semibold">
            We could not load this workspace
          </h1>
          <p className="mt-3 text-sm text-white/75">
            {error ?? "Your OpenGradHub profile could not be resolved."}
          </p>
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

  return <DashboardShell data={data} />;
}
