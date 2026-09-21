"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Menu } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import styles from "./workspace.module.css";

type WorkspaceHeaderProps = {
  title: string;
  subtitle?: string;
  subtitleLabel?: string;
  actions?: ReactNode;
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
};

export default function WorkspaceHeader({ title, subtitle, subtitleLabel, actions, onMenuClick, sidebarOpen = false }: WorkspaceHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const [compact, setCompact] = useState(false);

  function scrollToTop() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCompact(false);
    headerRef.current?.closest<HTMLElement>("[data-dashboard-shell]")?.removeAttribute("data-dashboard-compact");
    // Let the focused pill become inert before scrolling; that focus change
    // otherwise cancels the browser's smooth scroll.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
    });
  }

  useEffect(() => {
    const header = headerRef.current;
    const shell = header?.closest<HTMLElement>("[data-dashboard-shell]");
    if (!header || !shell) return;
    // Programme names can wrap; measure the real height so the sticky tabs
    // remain immediately below the heading at every screen width.
    const updateHeight = () => {
      shell.style.setProperty("--dashboard-header-height", `${header.offsetHeight}px`);
      shell.style.setProperty("--dashboard-pill-width", `${pillRef.current?.offsetWidth ?? 140}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    if (pillRef.current) observer.observe(pillRef.current);
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--dashboard-header-height");
      shell.style.removeProperty("--dashboard-pill-width");
    };
  }, []);

  useEffect(() => {
    const shell = headerRef.current?.closest<HTMLElement>("[data-dashboard-shell]");
    if (!shell) return;
    let anchor = Math.max(0, window.scrollY);
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - anchor;
      if (y > 24 && Math.abs(delta) < 12) return;
      const next = y > 64 && delta > 0;
      setCompact(next);
      shell.setAttribute("data-dashboard-compact", String(next));
      anchor = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      shell.removeAttribute("data-dashboard-compact");
    };
  }, []);

  return (
    <div className={styles.headerSpace}>
      <header ref={headerRef} data-compact={compact} className={styles.stickyHeader}>
        <div className={styles.fullHeader} inert={compact} aria-hidden={compact}>
          <div className="flex min-h-11 items-center gap-1.5 sm:gap-3">
            <span className="shrink-0 lg:hidden"><button type="button" onClick={onMenuClick} aria-label="Open sidebar" aria-controls="dashboard-navigation" aria-expanded={sidebarOpen} className={`${styles.utilityButton} ${styles.iconButton}`}>
              <Menu size={20} aria-hidden="true" />
            </button></span>
            <h1 className="min-w-0 text-lg font-bold tracking-tight text-[var(--color-text)] min-[380px]:text-2xl sm:text-4xl">{title}</h1>
            {subtitle && <div className="ml-3 hidden min-w-0 border-l border-[var(--color-border)] pl-6 lg:block">
              <p className="text-xs text-[var(--color-text-muted)]">{subtitleLabel}</p>
              <p className="mt-1 break-words text-sm font-semibold text-[var(--color-text)]">{subtitle}</p>
            </div>}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
              {actions}
              <NotificationBell />
            </div>
          </div>
          {subtitle && <p className="mt-3 break-words text-sm font-medium leading-relaxed text-[var(--color-text-muted)] lg:hidden">{subtitle}</p>}
        </div>
        <button ref={pillRef} type="button" onClick={scrollToTop} aria-label={`Back to top of ${title.toLowerCase()}`} title="Back to top" inert={!compact} aria-hidden={!compact} tabIndex={compact ? 0 : -1} className={styles.dashboardPill}>
          {title} <ArrowUp size={16} aria-hidden="true" />
        </button>
      </header>
    </div>
  );
}
