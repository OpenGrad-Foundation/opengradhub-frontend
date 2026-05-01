"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getNavModules } from "@/lib/moduleAccess";
import { clearStoredAuthToken, isClerkMode } from "@/lib/auth-session";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const clerk = useClerk();
  const { data } = useCurrentUser();

  const roleCode = data?.role?.code ?? "STUDENT";
  const programmeType = data?.user?.programme ?? null;
  const navModules = getNavModules(roleCode, programmeType);

  async function handleSignOut() {
    if (isClerkMode()) {
      await clerk.signOut();
      router.replace("/");
    } else {
      clearStoredAuthToken();
      router.replace("/");
    }
  }

  return (
    <aside
      className="flex min-h-screen w-[260px] flex-col bg-[var(--dark-teal)] text-white"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="px-6 pb-4 pt-6">
        <Link href="/dashboard" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="OpenGrad"
            width={160}
            height={48}
            className="h-12 w-auto"
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 px-4 pb-6">
        <ul className="space-y-1">
          {navModules.map((module) => {
            const isActive = isActivePath(pathname, module.href);

            return (
              <li key={module.key}>
                <Link
                  href={module.href}
                  className={
                    "flex items-center gap-3 rounded-r-xl border-l-4 px-4 py-2 text-sm font-medium transition " +
                    (isActive
                      ? "border-[var(--green)] bg-white/10 text-white"
                      : "border-transparent text-white/70 hover:bg-white/10 hover:text-white")
                  }
                >
                  {module.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 pb-6">
        <button
          id="sidebar-sign-out-btn"
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
