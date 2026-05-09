"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createBundle } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

const ALLOWED: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

export default function NewBundlePage() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId   = data?.user?.id ?? "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return null;

  if (!ALLOWED.includes(roleCode)) {
    return (
      <div style={glassCard}>
        <p style={labelSt}>Access Denied</p>
        <p style={{ ...headingSt, marginTop: "12px", fontSize: "18px" }}>
          Only Super Admins and Program Managers can create bundles.
        </p>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Bundle name is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const bundle = await createBundle({
        name: name.trim(),
        description: description.trim() || undefined,
        caller_id: userId,
        caller_role: roleCode,
      });
      router.replace(`/dashboard/bundles/${bundle.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bundle.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "600px" }}>
      {/* ── Back ───────────────────────────────────────────────── */}
      <Link href="/dashboard/bundles" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Back to Bundles
      </Link>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ margin: "16px 0 28px" }}>
        <p style={labelSt}>New Bundle</p>
        <h1 style={{ ...headingSt, fontSize: "28px", margin: "4px 0 0" }}>Create Bundle</h1>
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
          Set a name and description — you can add courses after saving.
        </p>
      </div>

      <form onSubmit={(e) => void handleCreate(e)}>
        <div style={glassCard}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <FieldGroup label="Bundle Name *">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Foundation Year Pack"
                style={inputSt}
              />
            </FieldGroup>

            <FieldGroup label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this bundle for? Who should it be assigned to?"
                rows={4}
                style={{ ...inputSt, resize: "vertical", fontFamily: "var(--font-body)" }}
              />
            </FieldGroup>

            {error && (
              <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <Link href="/dashboard/bundles" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                Cancel
              </Link>
              <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Creating…" : "Create Bundle & Add Courses →"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};

const headingSt: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0,
};

const primaryBtn: React.CSSProperties = {
  flex: 2, padding: "12px 22px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "14px", cursor: "pointer",
  boxShadow: "0 6px 14px rgba(10,190,98,0.2)", whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  flex: 1, padding: "12px 18px",
  border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "12px",
  background: "#ffffff", color: "#034852",
  fontFamily: "var(--font-heading)", fontWeight: 600,
  fontSize: "14px", cursor: "pointer", textAlign: "center",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(3,72,82,0.03)",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
};
