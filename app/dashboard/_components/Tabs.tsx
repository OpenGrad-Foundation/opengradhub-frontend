"use client";

import React, { Suspense, useId } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type TabDef = {
  key: string;
  label: string;
  panel: React.ReactNode;
};

type TabsProps = {
  tabs: TabDef[];
  ariaLabel: string;
  /** Query-string key the active tab is stored under. */
  param?: string;
};

function TabStrip({
  tabs,
  activeKey,
  ariaLabel,
  idPrefix,
  onSelect,
}: {
  tabs: TabDef[];
  activeKey: string;
  ariaLabel: string;
  idPrefix: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-selected={isActive}
            onClick={() => onSelect?.(tab.key)}
            className={
              'px-4 py-2 text-sm font-semibold border-b-2 transition-colors ' +
              (isActive
                ? 'border-[var(--teal)] text-[var(--dark-teal)]'
                : 'border-transparent text-slate-500 hover:text-[var(--dark-teal)]')
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function TabsInner({ tabs, ariaLabel, param = 'tab', idPrefix }: TabsProps & { idPrefix: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const raw = params.get(param);
  // Unknown or absent value falls back to the first tab rather than rendering
  // nothing — a stale bookmark pointing at a removed tab still works.
  const activeKey = tabs.some((t) => t.key === raw) ? (raw as string) : tabs[0].key;

  function select(key: string) {
    // Clone rather than rebuild: unrelated params (filters, ids) survive a tab switch.
    const next = new URLSearchParams(params.toString());
    next.set(param, key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div>
      <TabStrip
        tabs={tabs}
        activeKey={activeKey}
        ariaLabel={ariaLabel}
        idPrefix={idPrefix}
        onSelect={select}
      />
      <div
        role="tabpanel"
        id={`${idPrefix}-panel-${activeKey}`}
        aria-labelledby={`${idPrefix}-tab-${activeKey}`}
      >
        {tabs.find((t) => t.key === activeKey)?.panel}
      </div>
    </div>
  );
}

/**
 * Tab strip whose active tab lives in the URL (`?tab=`), so a tab is linkable.
 *
 * `useSearchParams` opts a statically-rendered route into client-side rendering,
 * which Next requires a `<Suspense>` boundary for. That boundary lives here rather
 * than at each call site so callers cannot forget it. The fallback renders the
 * strip alone — never a panel — so panel children (which typically fire queries)
 * don't mount and unmount again during hydration.
 */
export function Tabs({ tabs, ariaLabel, param = 'tab' }: TabsProps) {
  const idPrefix = useId();
  if (tabs.length === 0) return null;

  return (
    <Suspense
      fallback={
        <TabStrip
          tabs={tabs}
          activeKey={tabs[0].key}
          ariaLabel={ariaLabel}
          idPrefix={idPrefix}
        />
      }
    >
      <TabsInner tabs={tabs} ariaLabel={ariaLabel} param={param} idPrefix={idPrefix} />
    </Suspense>
  );
}
