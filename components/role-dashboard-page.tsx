"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { roleCodeBySlug } from "@/lib/role-dashboard";
import ProfileError from "@/components/dashboard/ProfileError";

type RoleDashboardPageProps = {
  roleSlug: keyof typeof roleCodeBySlug;
};

export function RoleDashboardPage({ roleSlug }: RoleDashboardPageProps) {
  const router = useRouter();
  const profile = useCurrentUser();
  const { data, error, errorKind, isLoading } = profile;
  const canOpenDashboard = !!data && errorKind !== 'session' && errorKind !== 'not-provisioned' && errorKind !== 'forbidden';

  useEffect(() => {
    if (!data || !canOpenDashboard) {
      return;
    }

    const expectedRolePath = `/dashboard/${roleSlug}`;
    const targetPath =
      data.role.dashboardPath === expectedRolePath
        ? "/dashboard"
        : data.role.dashboardPath;

    router.replace(targetPath);
  }, [canOpenDashboard, data, roleSlug, router]);

  if (isLoading && !error) {
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

  if (!canOpenDashboard) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] px-6">
        <ProfileError profile={profile} />
      </div>
    );
  }

  return null;
}
