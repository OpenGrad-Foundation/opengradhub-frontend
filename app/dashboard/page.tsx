"use client";

import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import HeroBand from "./_components/HeroBand";
import NextLiveClassHero from "./_components/NextLiveClassHero";
import RoleDashboard from "./_components/RoleDashboard";

export default function DashboardPage() {
  const { data, error, isLoading } = useCurrentUser();

  if (isLoading) {
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

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-[rgba(3,72,82,0.08)] bg-white px-12 py-10 text-center shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0abe62]">Error</p>
          <p className="mt-3 text-xl font-bold text-[#034852]">Could not load profile</p>
          <p className="mt-2 text-sm text-[rgba(3,72,82,0.6)]">{error ?? "Unknown error"}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-gradient-to-br from-[#0abe62] to-[#006d6c] px-6 py-3 text-sm font-bold text-white"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const roleCode = data.role.code;
  const roleName = data.role.name;
  const userName = data.user.fullName;
  const programmeType = data.user.programme;

  return (
    <div>
      <HeroBand userName={userName} roleName={roleName} />
      {roleCode === "STUDENT" && data.user.id && (
        <NextLiveClassHero studentId={data.user.id} />
      )}
      <RoleDashboard role={roleCode} programmeType={programmeType} userId={data.user.id} />
    </div>
  );
}
