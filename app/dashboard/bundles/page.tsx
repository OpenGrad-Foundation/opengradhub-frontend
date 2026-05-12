"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getBundles, type Bundle } from "@/lib/api";

export default function BundlesPage() {
  const { isLoading } = useCurrentUser();
  const canCreate = usePermission(PERM.bundles.create);

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    setLoading(true);
    getBundles()
      .then(setBundles)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [isLoading]);

  if (isLoading) return <LoadingCard />;

  return (
    <div style={{ maxWidth: "960px" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px" }}>
        <div>
          <p style={label}>Curriculum</p>
          <h1 style={{ ...heading, fontSize: "28px", margin: "4px 0 0" }}>Course Bundles</h1>
          <p style={sub}>Group courses together and assign them to students in one action.</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/bundles/new" style={primaryBtn}>
            + New Bundle
          </Link>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <div style={{ ...glassCard, background: "rgba(229,62,62,0.06)", borderColor: "rgba(229,62,62,0.2)" }}>
          <p style={{ color: "#c53030", fontWeight: 600 }}>{error}</p>
        </div>
      ) : bundles.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px 32px" }}>
          <p style={{ fontSize: "36px", marginBottom: "12px" }}>📦</p>
          <p style={label}>No bundles yet</p>
          <p style={{ ...sub, marginTop: "8px" }}>Create your first bundle to start grouping courses.</p>
          {canCreate && (
            <Link href="/dashboard/bundles/new" style={{ ...primaryBtn, marginTop: "20px", display: "inline-block" }}>
              + Create Bundle
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {bundles.map((b) => <BundleCard key={b.id} bundle={b} />)}
        </div>
      )}
    </div>
  );
}

function BundleCard({ bundle }: { bundle: Bundle }) {
  return (
    <Link href={`/dashboard/bundles/${bundle.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          ...glassCard,
          padding: "24px 28px",
          cursor: "pointer",
          transition: "all 200ms ease",
          borderColor: "rgba(3,72,82,0.1)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 48px rgba(3,72,82,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)";
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
          <h3 style={{ ...heading, fontSize: "17px", margin: 0, flex: 1 }}>{bundle.name}</h3>
          <span style={{ fontSize: "20px", flexShrink: 0 }}>📦</span>
        </div>

        {bundle.description && (
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "0 0 16px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {bundle.description}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Chip icon="📚" value={bundle.course_count} label="course" />
          <Chip icon="👤" value={bundle.student_count} label="student" />
        </div>

        <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.35)", margin: "14px 0 0" }}>
          Created {new Date(bundle.created_at).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}

function Chip({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "4px 10px", borderRadius: "100px",
      background: "rgba(3,72,82,0.06)", fontSize: "12px",
      fontWeight: 600, color: "#034852",
    }}>
      {icon} {value} {label}{value !== 1 ? "s" : ""}
    </span>
  );
}

function LoadingCard() {
  return (
    <div style={{ ...glassCard, textAlign: "center" }}>
      <p style={label}>Loading</p>
      <p style={{ ...heading, marginTop: "12px", fontSize: "18px" }}>Fetching bundles…</p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const label: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};

const heading: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0,
};

const sub: React.CSSProperties = {
  fontSize: "14px", color: "rgba(3,72,82,0.55)", margin: "6px 0 0",
};

const primaryBtn: React.CSSProperties = {
  padding: "11px 22px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
  boxShadow: "0 6px 14px rgba(10,190,98,0.22)", textDecoration: "none",
  display: "inline-flex", alignItems: "center",
};
