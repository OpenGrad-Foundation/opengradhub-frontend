"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getNavModules } from "@/lib/moduleAccess";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data } = useCurrentUser();

  const roleCode = data?.role?.code ?? "STUDENT";
  const programmeType = data?.user?.programme ?? null;
  const navModules = getNavModules(roleCode, programmeType);

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
    </aside>
  );
}
