"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getProgrammes, type Programme } from "@/lib/api";

/**
 * Which programme a duplicate should land in.
 *
 * The server's rule (resolveDestinationProgramme): sole programme → chosen for
 * you; several → you must say; SUPER_ADMIN → any, or none for a GLOBAL copy.
 * This hook mirrors it so the picker only appears when there is a real choice.
 */
export type DuplicateDestinationState = {
  programmes: Programme[];
  selected: string;
  setSelected: (id: string) => void;
  /** True when the UI must show a picker before Duplicate is allowed. */
  needsChoice: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  /** What to send as programme_id. "" → null (server picks / GLOBAL for SA). */
  bodyValue: string | null;
  /** True when duplicating cannot succeed — no destination exists, or the list failed. */
  blocked: boolean;
  /** Why it is blocked, for the caller to render. Null when it is not. */
  blockedReason: string | null;
};

export function useDuplicateDestination(): DuplicateDestinationState {
  const { data, isLoading: userLoading } = useCurrentUser();
  const isSuperAdmin = (data?.role?.code ?? "") === "SUPER_ADMIN";
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Wait for identity. isSuperAdmin starts false while the user loads, so
    // fetching early filters the list by `is_member` for a super admin and then
    // refetches — briefly offering a destination set that is not theirs.
    if (userLoading) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setSelected("");
    void getProgrammes()
      .then((list) => {
        if (cancelled) return;
        // Membership is what the server checks; a programme you can merely see
        // (operational reach) is not a place your copy may land.
        const mine = isSuperAdmin ? list : list.filter((p) => p.is_member);
        setProgrammes(mine);
        if (!isSuperAdmin && mine.length === 1) setSelected(mine[0].id);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isSuperAdmin, userLoading]);

  const needsChoice = isSuperAdmin ? programmes.length > 0 : programmes.length > 1;
  // A super admin always has a destination — "no programme" means GLOBAL. For
  // anyone else an EMPTY list is a real dead end, and saying so beats letting
  // the server refuse after the click.
  //
  // A FAILED fetch is not that. Listing programmes needs `programmes.view`,
  // which duplicating does not: a caller holding only `courses.create` can be
  // refused this list and still have a perfectly good sole programme the server
  // will pick for them. Blocking on failure would deny a copy the backend would
  // have made, so failure stays fail-soft — send null and let the server decide.
  const blocked = !loading && !isSuperAdmin && !failed && programmes.length === 0;
  const blockedReason = blocked
    ? "You do not belong to any programme, so a copy has nowhere to live. Ask an administrator to add you to one."
    : null;

  return {
    programmes,
    selected,
    setSelected,
    needsChoice,
    isSuperAdmin,
    loading,
    bodyValue: selected || null,
    blocked,
    blockedReason,
  };
}

export function DestinationPicker({ state }: { state: DuplicateDestinationState }) {
  if (!state.needsChoice) return null;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(3,72,82,0.6)" }}>
        Copy into programme{state.isSuperAdmin ? "" : " *"}
      </span>
      <select
        value={state.selected}
        onChange={(e) => state.setSelected(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(3,72,82,0.16)", fontSize: "13px", color: "#034852", background: "#fff" }}
      >
        <option value="">{state.isSuperAdmin ? "Global (no programme)" : "Select a programme…"}</option>
        {state.programmes.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}
