"use client";

import { useState, useEffect, useRef } from "react";
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
  Shield,
  School,
  Layers,
  ListChecks,
  Settings,
  X,
  ChevronUp,
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
  HIDDEN_MODULE_KEYS,
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
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { data } = useCurrentUser();

  // Nav is driven entirely by the server's effective module list (role defaults
  // + per-user overrides). Show only modules we have presentation metadata for
  // (e.g. `notifications` is a PBAC module but lives in the bell, not the rail),
  // rendered in the canonical MODULE_META order.
  const grantedCodes = new Set(
    (data?.modules ?? []).map((m: { code: string }) => m.code),
  );
  const granted = MODULE_ORDER.filter((key) => grantedCodes.has(key)).map(
    (key) => ({ key, ...MODULE_META[key] }),
  );

  // Dashboard is pinned at top; grouped keys nest into their collapsible group;
  // everything else stays flat below. All three preserve MODULE_ORDER.
  const topModules = granted.filter((m) => m.key === "dashboard");
  const groups = NAV_GROUPS.map((group) => ({
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

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const navRef = useRef<HTMLElement>(null);

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
          if (v !== null) next[group.key] = v === "true";
        } catch {
          /* SSR / storage unavailable — keep default */
        }
      }
      return next;
    });
  }, []);

  // A group holding the active route is forced open, whatever the stored state.
  const isGroupOpen = (group: (typeof groups)[number]) =>
    group.modules.some((m) => isActivePath(pathname, m.href)) ||
    storedOpen[group.key];

  const toggleGroup = (group: (typeof groups)[number]) => {
    const next = !storedOpen[group.key];
    setStoredOpen((prev) => ({ ...prev, [group.key]: next }));
    try {
      localStorage.setItem(group.storageKey, String(next));
    } catch {
      /* ignore */
    }
  };

  // Group membership + open/closed state both change the nav's height, so the
  // scroll-indicator effect re-runs whenever this signature changes.
  const groupsSignature = groups
    .map((g) => `${g.key}:${g.modules.length}:${isGroupOpen(g)}`)
    .join("|");

  const checkScrollLimits = () => {
    const nav = navRef.current;
    if (!nav) return;

    const hasScrollableContent = nav.scrollHeight > nav.clientHeight;

    if (hasScrollableContent) {
      const isAtTop = nav.scrollTop <= 1;
      const isAtBottom = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 1;

      setCanScrollUp(!isAtTop);
      setCanScrollDown(!isAtBottom);
    } else {
      setCanScrollUp(false);
      setCanScrollDown(false);
    }
  };

  useEffect(() => {
    checkScrollLimits();

    const nav = navRef.current;
    if (!nav) return;

    const resizeObserver = new ResizeObserver(() => {
      checkScrollLimits();
    });
    resizeObserver.observe(nav);

    window.addEventListener("resize", checkScrollLimits);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, [topModules.length, restModules.length, groupsSignature]);

  useEffect(() => {
    checkScrollLimits();
  }, [pathname]);

  const scrollUp = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ top: -120, behavior: "smooth" });
    }
  };

  const scrollDown = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ top: 120, behavior: "smooth" });
    }
  };

  const renderLeaf = (module: { key: ModuleKey; label: string; href: string }) => {
    const isActive = isActivePath(pathname, module.href);
    const Icon = MODULE_ICONS[module.key];
    return (
      <li key={module.key}>
        <Link
          href={module.href}
          title={collapsed ? module.label : undefined}
          className={
            "relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors " +
            (collapsed ? "lg:gap-0 lg:px-0 lg:justify-center " : "") +
            (isActive
              ? "bg-teal-50 font-semibold text-[var(--teal)]"
              : "font-medium text-gray-600 hover:bg-gray-50 hover:text-[var(--dark-teal)]")
          }
        >
          {Icon && (
            <Icon
              size={18}
              className={isActive ? "text-[var(--teal)]" : "text-gray-400"}
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
        "flex h-full min-h-dvh shrink-0 flex-col bg-white border-r border-gray-200 shadow-sm transition-[width] duration-200 w-64 " +
        (collapsed ? "lg:w-[68px]" : "lg:w-64")
      }
    >
      {/* Logo + collapse toggle + mobile close */}
      <div
        className={
          "pb-4 pt-6 border-b border-gray-100 flex items-center px-6 " +
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
            className="hidden lg:flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden -mr-1 rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav Container with Scroll Indicators */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Top Scroll Indicator */}
        <div
          className={
            "absolute top-2 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 transform " +
            (canScrollUp
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-2 scale-75 pointer-events-none")
          }
        >
          <button
            type="button"
            onClick={scrollUp}
            className="flex items-center justify-center rounded-full bg-white p-1.5 text-[var(--teal)] shadow-md border border-gray-100 hover:bg-teal-50 hover:text-[var(--dark-teal)] hover:scale-110 active:scale-95 transition-all cursor-pointer animate-bounce"
            style={{ animationDuration: "2s" }}
            aria-label="Scroll up"
          >
            <ChevronUp size={16} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <nav
          ref={navRef}
          onScroll={checkScrollLimits}
          className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar scroll-smooth"
        >
          <ul className="space-y-0.5">
            {/* Pinned: Dashboard */}
            {topModules.map((module) => renderLeaf(module))}

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
                      className="relative flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-[var(--dark-teal)]"
                    >
                      {GroupIcon && (
                        <GroupIcon size={18} className="text-gray-400" aria-hidden="true" />
                      )}
                      <span>{group.label}</span>
                      {open ? (
                        <ChevronDown size={16} className="ml-auto text-gray-400" aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} className="ml-auto text-gray-400" aria-hidden="true" />
                      )}
                    </button>
                    {open && (
                      <ul className="mt-0.5 space-y-0.5 pl-4">
                        {group.modules.map((module) => renderLeaf(module))}
                      </ul>
                    )}
                  </li>
                );
              })}

            {/* Collapsed rail: group children flat as icons (no headers) */}
            {collapsed && groupedModules.map((module) => renderLeaf(module))}

            {/* Flat remainder */}
            {restModules.map((module) => renderLeaf(module))}
          </ul>
        </nav>

        {/* Bottom Scroll Indicator */}
        <div
          className={
            "absolute bottom-2 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 transform " +
            (canScrollDown
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-2 scale-75 pointer-events-none")
          }
        >
          <button
            type="button"
            onClick={scrollDown}
            className="flex items-center justify-center rounded-full bg-white p-1.5 text-[var(--teal)] shadow-md border border-gray-100 hover:bg-teal-50 hover:text-[var(--dark-teal)] hover:scale-110 active:scale-95 transition-all cursor-pointer animate-bounce"
            style={{ animationDuration: "2s" }}
            aria-label="Scroll down"
          >
            <ChevronDown size={16} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

    </aside>
  );
}
