"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Package,
  ClipboardList,
  Database,
  FileText,
  Video,
  Calendar,
  CalendarCheck,
  FolderOpen,
  HelpCircle,
  Bell,
  BarChart2,
  FileBarChart,
  Download,
  Users,
  UsersRound,
  Shield,
  School,
  Layers,
  ListChecks,
  Settings,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  MODULE_META,
  NAV_GROUPS,
  GROUPED_MODULE_KEYS,
  type ModuleKey,
  type NavGroupKey,
} from "@/lib/moduleAccess";

// Nav order = the order MODULE_META is declared in.
const MODULE_ORDER = Object.keys(MODULE_META) as ModuleKey[];

// ── Icon map ────────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard:       LayoutDashboard,
  courses:         BookOpen,
  bundles:         Package,
  assessments:     ClipboardList,
  test_bank:       Database,
  assignments:     FileText,
  live_classes:    Video,
  calendar:        Calendar,
  resources:       FolderOpen,
  doubts:          HelpCircle,
  inbox:           Bell,
  analytics:       BarChart2,
  reports:         FileBarChart,
  student_export:  Download,
  students:        UsersRound,
  user_management: Users,
  role_management: Shield,
  programmes:      GraduationCap,
  schools:         School,
  batches:         Layers,
  tracker:         ListChecks,
  attendance:      CalendarCheck,
};

const GROUP_ICONS: Record<NavGroupKey, LucideIcon> = {
  lms:        Layers,
  management: Settings,
};

// ── Active path helper ───────────────────────────────────────────────────────

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard/courses" && pathname.startsWith("/dashboard/course-management/")) return true;
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({
  onClose,
  collapsed = false,
  onToggleCollapsed,
  footer,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data } = useCurrentUser();
  const isProgramManager = data?.role?.code === "PROGRAM_MANAGER";

  // Nav is driven entirely by the server's effective module list (role defaults
  // + per-user overrides). Show only modules we have presentation metadata for
  // (e.g. `notifications` is a PBAC module but lives in the bell, not the rail),
  // rendered in the canonical MODULE_META order.
  const grantedCodes = new Set(
    (data?.modules ?? []).map((m: { code: string }) => m.code),
  );
  const granted = MODULE_ORDER.filter((key) => grantedCodes.has(key)).map(
    (key) => {
      const permissions = new Set(data?.permissions ?? []);
      if (key === "courses" && !permissions.has("courses.view") && permissions.has("courses.create")) return { key, label: "Duplicate courses", href: "/dashboard/courses/duplicate" };
      if (key === "test_bank" && !permissions.has("test_bank.view") && permissions.has("test_bank.create")) return { key, label: "Duplicate quizzes", href: "/dashboard/test-bank/duplicate" };
      return { key, ...MODULE_META[key] };
    },
  );

  // Dashboard is pinned at top; grouped keys nest into their collapsible group;
  // everything else stays flat below. All three preserve MODULE_ORDER.
  const topModules = granted.filter((m) => m.key === "dashboard");
  const groups = (isProgramManager ? [...NAV_GROUPS].reverse() : NAV_GROUPS).map((group) => ({
    ...group,
    modules: granted.filter(
      (m) => m.key !== "dashboard" && group.members.has(m.key),
    ),
  })).filter((group) => group.modules.length > 0);
  const restModules = granted.filter(
    (m) => m.key !== "dashboard" && !GROUPED_MODULE_KEYS.has(m.key),
  );
  // Every leaf that lives inside some group, in MODULE_ORDER — what the
  // collapsed rail shows flat, since it has no room for group headers.
  const groupedModules = groups.flatMap((group) => group.modules);
  const groupCount = groups.length;

  // Per-group open state, persisted across sessions. Groups default to open and
  // are read from storage in an effect (not during render) to avoid an
  // SSR/hydration mismatch.
  const [storedOpen, setStoredOpen] = useState<Record<NavGroupKey, boolean>>(
    () =>
      Object.fromEntries(
        NAV_GROUPS.map((g) => [g.key, true]),
      ) as Record<NavGroupKey, boolean>,
  );
  useEffect(() => {
    setStoredOpen((prev) => {
      const next = { ...prev };
      for (const group of NAV_GROUPS) {
        try {
          const v = localStorage.getItem(group.storageKey);
          // Staff see several groups: start them closed so the list stays short.
          // A lone group (a student's LMS) starts open — it holds most of their links.
          next[group.key] = v !== null ? v === "true" : groupCount === 1;
        } catch {
          /* SSR / storage unavailable — keep default */
        }
      }
      return next;
    });
  }, [groupCount]);

  // Navigating into a group opens it (after the stored state loads), but it is
  // not forced: the header can still collapse it while a child is active.
  const activeGroupKey = groups.find((g) => g.modules.some((m) => isActivePath(pathname, m.href)))?.key;
  useEffect(() => {
    if (activeGroupKey) setStoredOpen((prev) => (prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }));
  }, [activeGroupKey, groupCount]);

  const isGroupOpen = (group: (typeof groups)[number]) => storedOpen[group.key];

  const toggleGroup = (group: (typeof groups)[number]) => {
    const next = !storedOpen[group.key];
    setStoredOpen((prev) => ({ ...prev, [group.key]: next }));
    try {
      localStorage.setItem(group.storageKey, String(next));
    } catch {
      /* ignore */
    }
  };

  const renderLeaf = (module: { key: ModuleKey; label: string; href: string }) => {
    const isActive = isActivePath(pathname, module.href);
    const Icon = MODULE_ICONS[module.key];
    return (
      <li key={module.key}>
        <Link
          href={module.href}
          onClick={onClose}
          aria-current={isActive ? "page" : undefined}
          aria-label={collapsed ? module.label : undefined}
          title={collapsed ? module.label : undefined}
          className={
            "relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors " +
            (collapsed ? "lg:gap-0 lg:px-0 lg:justify-center " : "") +
            (isActive
              ? "bg-[var(--green)] font-semibold text-[var(--dark-teal)]"
              : "font-medium text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text)]")
          }
        >
          {Icon && (
            <Icon
              size={18}
              className="shrink-0"
              aria-hidden="true"
            />
          )}
          <span className={collapsed ? "lg:hidden" : ""}>{module.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={
        "flex h-full min-h-0 shrink-0 flex-col bg-[#eef5f3] border-r border-[var(--color-border)] transition-[width] duration-200 w-64 " +
        (collapsed ? "lg:w-[68px]" : "lg:w-64")
      }
    >
      {/* Logo + collapse toggle + mobile close */}
      <div
        className={
          "py-5 flex shrink-0 items-center px-5 " +
          (collapsed ? "lg:px-3 lg:justify-center" : "justify-between")
        }
      >
        <Link
          href="/dashboard"
          className={"inline-flex items-center " + (collapsed ? "lg:hidden" : "")}
          onClick={onClose}
        >
          <Image
            src="/logo.png"
            alt="OpenGrad"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
        {/* Desktop collapse toggle */}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden lg:flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden -mr-1 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text)]"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav Container with Scroll Indicators */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Scrollable Nav Area */}
        <nav
          aria-label="Main navigation"
          className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 [scrollbar-width:thin]"
        >
          <ul className="space-y-0.5">
            {/* Pinned: Dashboard */}
            {topModules.map((module) => renderLeaf(module))}

            {isProgramManager && restModules.map((module) => renderLeaf(module))}

            {/* Collapsible groups (expanded sidebar only) */}
            {!collapsed &&
              groups.map((group) => {
                const open = isGroupOpen(group);
                const GroupIcon = GROUP_ICONS[group.key];
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      aria-expanded={open}
                      className={"relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors hover:bg-white hover:text-[var(--color-text)] " + (group.modules.some((m) => isActivePath(pathname, m.href)) ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text-muted)]")}
                    >
                      {GroupIcon && (
                        <GroupIcon size={18} className="shrink-0" aria-hidden="true" />
                      )}
                      <span>{group.label}</span>
                      {open ? (
                        <ChevronDown size={16} className="ml-auto opacity-60" aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} className="ml-auto opacity-60" aria-hidden="true" />
                      )}
                    </button>
                    {open && (
                      <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2">
                        {group.modules.map((module) => renderLeaf(module))}
                      </ul>
                    )}
                  </li>
                );
              })}

            {/* Collapsed rail: group children flat as icons (no headers) */}
            {collapsed && groupedModules.map((module) => renderLeaf(module))}

            {/* Flat remainder */}
            {!isProgramManager && restModules.map((module) => renderLeaf(module))}
          </ul>
        </nav>

      </div>

      {footer && <div className="shrink-0 border-t border-[var(--color-border)] p-3">{footer}</div>}
    </aside>
  );
}
