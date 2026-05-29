"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchCatalogue,
  fetchOverrides,
  fetchEffectivePermissions,
  addOverride,
  deleteOverride,
  type Override,
  type CatalogueModule,
  type EffectivePermissions,
} from "@/app/dashboard/role-management/role-management.utils";
import { clearUserCache } from "@/hooks/use-current-user";

interface UserOverrideEditorProps {
  userId: string;
  callerId: string;
}

type PermState = "ALLOW" | "DENY" | "NONE";
type PendingAction = "ALLOW" | "DENY" | "CLEAR";

function actionOf(permCode: string): string {
  return permCode.includes(".") ? permCode.slice(permCode.indexOf(".") + 1) : permCode;
}

export function UserOverrideEditor({ userId, callerId }: UserOverrideEditorProps) {
  const [modules, setModules] = useState<CatalogueModule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [effective, setEffective] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState("dashboard");
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingAction>>({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const isSelf = userId === callerId;
  const dirty = Object.keys(pendingChanges).length > 0;
  const pendingCount = Object.keys(pendingChanges).length;

  useEffect(() => {
    let cancelled = false;
    fetchCatalogue()
      .then((cat) => {
        if (cancelled) return;
        setModules(cat.modules);
        if (cat.modules.length > 0 && !cat.modules.some((m) => m.code === "dashboard")) {
          setSelectedModule(cat.modules[0].code);
        }
      })
      .catch(() => { if (!cancelled) setModules([]); });
    return () => { cancelled = true; };
  }, []);

  const loadOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const [ovs, eff] = await Promise.all([
        fetchOverrides(userId),
        fetchEffectivePermissions(userId).catch(() => null),
      ]);
      setOverrides(ovs);
      setEffective(eff);
    } catch {
      setOverrides([]);
      setEffective(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadOverrides();
    setPendingChanges({});
    setSaveErr(null);
    setSaveOk(false);
    setSelectedModule("dashboard");
  }, [userId, loadOverrides]);

  function getPermState(permCode: string): PermState {
    const pending = pendingChanges[permCode];
    if (pending === "ALLOW") return "ALLOW";
    if (pending === "DENY") return "DENY";
    if (pending === "CLEAR") return "NONE";
    const saved = overrides.find((o) => o.permission_code === permCode);
    if (saved) return saved.effect as PermState;
    if (effective && effective.permissions.includes(permCode)) return "ALLOW";
    return "NONE";
  }

  function setPending(permCode: string, action: PendingAction) {
    setPendingChanges((prev) => {
      const savedOverride = overrides.find((o) => o.permission_code === permCode);
      const savedEffect = savedOverride?.effect ?? null;
      if (
        (action === "ALLOW" && savedEffect === "ALLOW") ||
        (action === "DENY" && savedEffect === "DENY") ||
        (action === "CLEAR" && !savedOverride)
      ) {
        const next = { ...prev };
        delete next[permCode];
        return next;
      }
      return { ...prev, [permCode]: action };
    });
  }

  function handleToggle(permCode: string) {
    setPending(permCode, getPermState(permCode) === "ALLOW" ? "CLEAR" : "ALLOW");
  }
  function handleDeny(permCode: string) {
    setPending(permCode, getPermState(permCode) === "DENY" ? "CLEAR" : "DENY");
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      for (const [permCode, action] of Object.entries(pendingChanges)) {
        if (action === "ALLOW" || action === "DENY") {
          await addOverride(userId, permCode, action, callerId);
        } else {
          const existing = overrides.find((o) => o.permission_code === permCode);
          if (existing) await deleteOverride(userId, existing.id);
        }
      }
      const fresh = await fetchOverrides(userId);
      setOverrides(fresh);
      setPendingChanges({});
      if (isSelf) {
        clearUserCache();
        window.location.reload();
        return;
      }
      const eff = await fetchEffectivePermissions(userId).catch(() => null);
      setEffective(eff);
      setSaveOk(true);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const selectedMod = modules.find((m) => m.code === selectedModule);
  const selectedModuleName = selectedMod?.name ?? selectedModule;
  const selectedActions = selectedMod?.permissions.map((p) => actionOf(p.code)) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)", margin: "0 0 12px" }}>
        Toggles grant explicit access for this user. Use Deny to block a role default.
      </p>
      <div style={{ display: "flex", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "12px", overflow: "hidden", minHeight: "320px" }}>
        <div style={{ width: "150px", borderRight: "1px solid rgba(3,72,82,0.08)", overflowY: "auto", flexShrink: 0, padding: "8px 0" }}>
          {modules.map((mod) => {
            const active = selectedModule === mod.code;
            const hasPending = mod.permissions.some((p) => pendingChanges[p.code]);
            return (
              <button
                key={mod.code}
                onClick={() => setSelectedModule(mod.code)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 14px", border: "none", background: active ? "rgba(10,190,98,0.08)" : "transparent", borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`, color: active ? "#034852" : "rgba(3,72,82,0.6)", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: active ? 600 : 400, cursor: "pointer", textAlign: "left" }}
              >
                <span>{mod.name}</span>
                {hasPending && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {loading ? (
            <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>Loading permissions…</p>
          ) : (
            <>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: "15px", fontWeight: 700, color: "#034852", margin: "0 0 12px" }}>{selectedModuleName}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {selectedActions.map((action) => {
                  const permCode = `${selectedModule}.${action}`;
                  const state = getPermState(permCode);
                  const isPending = Boolean(pendingChanges[permCode]);
                  return (
                    <PermissionRow key={permCode} action={action} state={state} isPending={isPending} onToggle={() => handleToggle(permCode)} onDeny={() => handleDeny(permCode)} />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", gap: "10px" }}>
        <div>
          {saveErr && <span style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600 }}>{saveErr}</span>}
          {saveOk && !dirty && <span style={{ fontSize: "12px", color: "#0abe62", fontWeight: 600 }}>Saved. Takes effect on the user&apos;s next refresh.</span>}
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          style={{ padding: "9px 18px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: saving || !dirty ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : dirty ? `Save (${pendingCount})` : "Saved"}
        </button>
      </div>
    </div>
  );
}

function PermissionRow({ action, state, isPending, onToggle, onDeny }: { action: string; state: PermState; isPending: boolean; onToggle: () => void; onDeny: () => void; }) {
  const isAllow = state === "ALLOW";
  const isDeny = state === "DENY";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: isPending ? "rgba(245,158,11,0.04)" : "rgba(3,72,82,0.02)", border: isPending ? "1px solid rgba(245,158,11,0.2)" : "1px solid transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#034852", textTransform: "capitalize" }}>{action}</span>
        {isPending && <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#92400e", background: "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: "4px" }}>Unsaved</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button type="button" onClick={onDeny} title={isDeny ? "Click to clear deny override" : "Click to explicitly deny"} style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, cursor: "pointer", borderWidth: "1px", borderStyle: "solid", background: isDeny ? "rgba(229,62,62,0.12)" : "transparent", borderColor: isDeny ? "rgba(229,62,62,0.4)" : "rgba(3,72,82,0.15)", color: isDeny ? "#c53030" : "rgba(3,72,82,0.35)" }}>
          {isDeny ? "Denied" : "Deny"}
        </button>
        <ToggleSwitch on={isAllow} onChange={onToggle} />
      </div>
    </div>
  );
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: on ? "#0abe62" : "rgba(3,72,82,0.15)", position: "relative", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 200ms", display: "block" }} />
    </button>
  );
}
