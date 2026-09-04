"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getQuizzes, type Quiz } from "@/lib/api";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

type Row = Omit<Quiz, "questions">;

/**
 * Browse every programme's standalone quizzes to pick one to duplicate.
 * Read-only: the copy is taken from the detail page, never from here.
 */
export default function DuplicateQuizBrowsePage() {
  const { has, isLoading: permLoading } = usePermissions();
  const currentUrl = useCurrentUrl();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("ALL");

  const canCreate = has(PERM.test_bank.create);

  useEffect(() => {
    if (permLoading || !canCreate) return;
    let cancelled = false;
    void getQuizzes({ quiz_type: "GLOBAL_TEST", scope: "all" })
      .then((list) => { if (!cancelled) setRows(list); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load quizzes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [permLoading, canCreate]);

  const programmes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.owner_programme_id && r.owner_programme_name) seen.set(r.owner_programme_id, r.owner_programme_name);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (programme === "GLOBAL" && r.effective_scope_mode !== "GLOBAL") return false;
      if (programme !== "ALL" && programme !== "GLOBAL" && r.owner_programme_id !== programme) return false;
      return !term || r.title.toLowerCase().includes(term);
    });
  }, [rows, search, programme]);

  if (permLoading) return null;
  if (!canCreate) {
    return (
      <div style={glassCard}>
        <p style={label}>Access Denied</p>
        <p style={{ ...heading, fontSize: "22px", marginTop: "12px" }}>You don&apos;t have permission to duplicate quizzes.</p>
      </div>
    );
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={{ maxWidth: "960px" }}>
      <BackLink fallback="/dashboard/quiz-builder/new" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Back
      </BackLink>
      <p style={{ ...label, marginTop: "12px" }}>Global Quiz</p>
      <h1 style={{ ...heading, fontSize: "28px", margin: "4px 0 6px" }}>Duplicate a quiz</h1>
      <p style={{ margin: "0 0 20px", fontSize: "14px", color: "rgba(3,72,82,0.65)" }}>
        Browse every programme&apos;s quizzes. Open one to review it, then duplicate it into your programme.
      </p>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title…"
          style={{ ...input, flex: 1, minWidth: "220px" }}
        />
        <select value={programme} onChange={(e) => setProgramme(e.target.value)} style={input}>
          <option value="ALL">All programmes</option>
          <option value="GLOBAL">Shared with all programmes</option>
          {programmes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
        {loading && <p style={{ ...muted, padding: "18px 24px" }}>Loading quizzes…</p>}
        {error && <p style={{ ...muted, padding: "18px 24px", color: "#e53e3e" }}>{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p style={{ ...muted, padding: "18px 24px" }}>No quizzes match.</p>
        )}
        {visible.map((q, i) => (
          <div
            key={q.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3.5 px-6 py-4"
            style={{ borderBottom: i === visible.length - 1 ? "none" : "1px solid rgba(3,72,82,0.06)" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852" }}>{q.title}</p>
              <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                <Tag>{q.published ? "Published" : "Draft"}</Tag>
                <Tag>{q.effective_scope_mode === "GLOBAL" ? "Shared with all programmes" : q.owner_programme_name ?? "Unassigned"}</Tag>
                {q.duration_minutes != null && <Tag>{q.duration_minutes} min</Tag>}
                <Tag>Created {fmt(q.created_at)}</Tag>
              </div>
            </div>
            <Link href={withFrom(`/dashboard/quiz-builder/duplicate/${q.id}`, currentUrl)} style={outlineBtn}>
              Review →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.6)" }}>
      {children}
    </span>
  );
}

const glassCard: React.CSSProperties = { background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px", padding: "28px 32px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)" };
const label: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 };
const heading: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0 };
const muted: React.CSSProperties = { margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.55)" };
const input: React.CSSProperties = { padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(3,72,82,0.16)", fontSize: "13px", color: "#034852", background: "#fff" };
const outlineBtn: React.CSSProperties = { padding: "8px 14px", borderRadius: "10px", border: "1px solid rgba(3,72,82,0.18)", background: "#fff", color: "#034852", fontSize: "12px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };
