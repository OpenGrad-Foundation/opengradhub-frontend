"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { clearStoredAuthToken, isClerkMode } from "@/lib/auth-session";
import type { CurrentUserResponse } from "@/lib/types";

type DashboardShellProps = {
  data: CurrentUserResponse;
};

export function DashboardShell({ data }: DashboardShellProps) {
  const router = useRouter();
  const [selectedModuleCode, setSelectedModuleCode] = useState(
    data.modules[0]?.code ?? "",
  );

  const clerkMode = isClerkMode();

  // Clerk hooks must always be called (React rules of hooks).
  const clerk = useClerk();

  const selectedModule = useMemo(() => {
    return (
      data.modules.find((moduleItem) => moduleItem.code === selectedModuleCode) ??
      data.modules[0] ??
      null
    );
  }, [data.modules, selectedModuleCode]);

  async function handleLogout() {
    if (clerkMode) {
      await clerk.signOut();
      router.replace("/");
    } else {
      clearStoredAuthToken();
      router.replace("/");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row">
        <aside className="relative overflow-hidden border-b border-white/10 bg-[var(--color-deep-teal)] lg:min-h-screen lg:w-[320px] lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,222,0,0.22),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(10,190,98,0.20),_transparent_34%)]" />
          <div className="relative flex h-full flex-col px-6 py-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-sun)]">
                OpenGradHub
              </p>
              <div>
                <h1 className="font-display text-3xl font-semibold text-white">
                  {data.role.name}
                </h1>
                <p className="mt-2 text-sm text-white/70">
                  {data.user.fullName}
                </p>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-mint)]">
                  {data.role.code.replaceAll("_", " ")}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-white/12 bg-white/6 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                User Scope
              </p>
              <div className="mt-4 space-y-3 text-sm text-white/80">
                <div className="dashboard-meta-row">
                  <span>Programme</span>
                  <strong>{data.user.programme ?? "Not set"}</strong>
                </div>
                <div className="dashboard-meta-row">
                  <span>Zone</span>
                  <strong>{data.user.zone ?? "Not set"}</strong>
                </div>
                <div className="dashboard-meta-row">
                  <span>School</span>
                  <strong>{data.user.schoolName ?? "Not set"}</strong>
                </div>
              </div>
            </div>

            <nav className="mt-8 flex-1">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                Modules
              </p>
              <div className="space-y-3">
                {data.modules.map((moduleItem) => {
                  const isActive = selectedModule?.code === moduleItem.code;

                  return (
                    <button
                      key={moduleItem.code}
                      type="button"
                      onClick={() => setSelectedModuleCode(moduleItem.code)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition duration-200 ${
                        isActive
                          ? "border-[var(--color-sun)] bg-[var(--color-sun)]/16 shadow-[0_18px_36px_rgba(255,222,0,0.10)]"
                          : "border-white/10 bg-white/4 hover:border-[var(--color-green)]/45 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-lg font-medium text-white">
                            {moduleItem.name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/50">
                            {moduleItem.permissions.length} permissions
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-[var(--color-aqua)]">
                          {moduleItem.code}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 rounded-2xl border border-[var(--color-sun)]/55 bg-[var(--color-sun)] px-4 py-3 text-sm font-semibold text-[var(--color-deep-teal)] transition hover:bg-[var(--color-sun-soft)]"
            >
              Log Out
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-[2rem] border border-white/10 bg-white px-6 py-6 text-[var(--color-ink)] shadow-[0_24px_60px_rgba(3,72,82,0.28)] sm:px-8 sm:py-8">
              <div className="flex flex-col gap-4 border-b border-[var(--color-green-muted)]/25 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-green-deep)]">
                    Dashboard Outline
                  </p>
                  <h2 className="font-display mt-3 text-3xl font-semibold text-[var(--color-deep-teal)]">
                    {selectedModule?.name ?? "No module selected"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-ink)]/70">
                    This main panel is intentionally a placeholder for now. We are
                    using it as the role-based workspace area that will later host
                    real module screens, forms, charts, and actions.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--color-green-muted)]/35 bg-[var(--color-mint-soft)] px-4 py-3 text-sm text-[var(--color-deep-teal)]">
                  <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-green-deep)]">
                    Active Module
                  </span>
                  <strong className="mt-1 block font-display text-lg">
                    {selectedModule?.code ?? "N/A"}
                  </strong>
                </div>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <div className="dashboard-card">
                  <p className="dashboard-card-label">Planned Screen</p>
                  <h3 className="dashboard-card-title">Module workspace</h3>
                  <p className="dashboard-card-copy">
                    This is where the selected module&apos;s content will render.
                    For now it stays as a scaffolded blank area.
                  </p>
                </div>

                <div className="dashboard-card">
                  <p className="dashboard-card-label">Navigation rule</p>
                  <h3 className="dashboard-card-title">Sidebar-driven</h3>
                  <p className="dashboard-card-copy">
                    Each sidebar item acts as the dashboard navigation entrypoint.
                    Permissions decide which module buttons appear here.
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-dashed border-[var(--color-green)]/40 bg-[linear-gradient(135deg,rgba(166,219,116,0.18),rgba(255,255,255,0.75))] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-green-deep)]">
                  Placeholder Canvas
                </p>
                <div className="mt-4 grid min-h-[280px] place-items-center rounded-[1.5rem] border border-[var(--color-green)]/20 bg-white/70 p-8 text-center">
                  <div className="max-w-lg">
                    <h3 className="font-display text-2xl font-semibold text-[var(--color-deep-teal)]">
                      {selectedModule?.name ?? "Module"} module area
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--color-ink)]/70">
                      We&apos;ll plug the actual module UI into this panel later.
                      Right now this gives us a stable, role-aware dashboard shell
                      to build on.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-white/12 bg-[var(--color-deep-teal)] px-6 py-6 text-white shadow-[0_24px_60px_rgba(3,72,82,0.28)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-sun)]">
                  Sidebar Source
                </p>
                <h3 className="font-display mt-3 text-2xl font-semibold">
                  Effective permissions
                </h3>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  This sidebar is being built directly from the effective
                  permissions returned by the backend for the signed-in local user.
                </p>
              </section>

              <section className="rounded-[2rem] border border-white/12 bg-white/6 px-6 py-6 text-white backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-mint)]">
                  Module permissions
                </p>
                <ul className="mt-4 space-y-3">
                  {selectedModule?.permissions.map((permission) => (
                    <li
                      key={permission.code}
                      className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-white">
                        {permission.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                        {permission.code}
                      </p>
                    </li>
                  )) ?? (
                    <li className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/65">
                      No permissions available yet.
                    </li>
                  )}
                </ul>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
