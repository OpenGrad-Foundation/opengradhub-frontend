"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import ProfileError from "@/components/dashboard/ProfileError";
import { roleLabel } from "@/lib/labels";
import HeroBand from "./_components/HeroBand";
import NextLiveClassHero from "./_components/NextLiveClassHero";
import RoleDashboard from "./_components/RoleDashboard";

export default function DashboardPage() {
  const profile = useCurrentUser();
  const { data, error, errorKind, isLoading } = profile;

  if (isLoading && !error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-3xl border border-[rgba(3,72,82,0.08)] bg-white px-12 py-10 text-center shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0abe62]">Loading</p>
          <p className="mt-3 text-xl font-bold text-[#034852]">Opening your dashboard</p>
          <p className="mt-2 text-sm text-[rgba(3,72,82,0.6)]">Fetching your OpenGrad workspace…</p>
        </div>
      </div>
    );
  }

  if (!data || errorKind === 'session' || errorKind === 'not-provisioned' || errorKind === 'forbidden') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <ProfileError profile={profile} />
      </div>
    );
  }

  const roleCode = data.role.code;
  const roleName = roleLabel(data.role.name);
  const userName = data.user.fullName;
  const programmeType = data.user.programme;

  return (
    <div>
      <HeroBand userName={userName} roleName={roleName} />
      {error && <div className="mb-6"><ProfileError profile={profile} /></div>}
      {roleCode === "STUDENT" && data.user.id && (
        <NextLiveClassHero studentId={data.user.id} />
      )}
      <RoleDashboard role={roleCode} programmeType={programmeType} userId={data.user.id} />
    </div>
  );
}
