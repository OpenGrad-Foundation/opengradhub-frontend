"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getResources, createResource, type Resource } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

// ── Role guards (from RBAC_MODULES.md row 4) ──────────────────

const RESOURCES_ALLOWED_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "STUDENT",
];

const RESOURCE_CREATE_ROLES: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

// ── Type → colour mapping ──────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  PDF:   { bg: "rgba(220,38,38,0.10)", color: "#dc2626", icon: "📄" },
  VIDEO: { bg: "rgba(10,190,98,0.10)", color: "#0abe62", icon: "▶️" },
  LINK:  { bg: "rgba(0,109,108,0.10)", color: "#006d6c", icon: "🔗" },
  DOC:   { bg: "rgba(59,130,246,0.10)", color: "#3b82f6", icon: "📝" },
};

// ── Page ───────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { data, isLoading: userLoading } = useCurrentUser();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const roleCode = (data?.role?.code ?? "STUDENT") as RoleCode;
  const programmeType = data?.user?.programme ?? null;
  const isAllowed = RESOURCES_ALLOWED_ROLES.includes(roleCode);
  const canCreate = RESOURCE_CREATE_ROLES.includes(roleCode);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter =
        roleCode === "STUDENT" && programmeType ? programmeType : undefined;
      const data = await getResources(filter);
      setResources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources.");
    } finally {
      setLoading(false);
    }
  }, [roleCode, programmeType]);

  useEffect(() => {
    if (!userLoading && isAllowed) {
      void fetchResources();
    }
  }, [userLoading, isAllowed, fetchResources]);

  // ── Role guard ─────────────────────────────────────────────

  if (userLoading) {
    return <LoadingState />;
  }

  if (!isAllowed) {
    return (
      <div style={glassCard}>
        <p style={labelStyle}>Access Denied</p>
        <p style={{ ...titleStyle, marginTop: "12px" }}>
          You do not have access to the Resources module.
        </p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>
          Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}
      >
        <div>
          <p style={labelStyle}>Library</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>
            Resources
          </h1>
          <p style={{ ...subtitleStyle, marginTop: "4px" }}>
            {roleCode === "STUDENT"
              ? `Study materials for ${programmeType ?? "all"} programme`
              : "All study materials across programmes"}
          </p>
        </div>

        {canCreate && (
          <button
            id="add-resource-btn"
            onClick={() => setShowForm((prev) => !prev)}
            style={primaryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 12px 20px rgba(10,190,98,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 8px 16px rgba(10,190,98,0.2)";
            }}
          >
            {showForm ? "✕ Cancel" : "+ Add Resource"}
          </button>
        )}
      </div>

      {/* ── Create form ─────────────────────────────────────── */}
      {showForm && data && (
        <CreateResourceForm
          userId={data.user.id}
          roleCode={roleCode}
          onCreated={() => {
            setShowForm(false);
            void fetchResources();
          }}
        />
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={glassCard}>
          <p style={labelStyle}>Error</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>{error}</p>
        </div>
      ) : resources.length === 0 ? (
        <div style={glassCard}>
          <p style={labelStyle}>No Resources</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>
            No study materials available yet.
          </p>
          <p style={{ ...subtitleStyle, marginTop: "8px" }}>
            {canCreate
              ? 'Click "Add Resource" to upload one.'
              : "Check back soon — new materials are being added."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resource Card ──────────────────────────────────────────────

function ResourceCard({ resource }: { resource: Resource }) {
  const [hovered, setHovered] = useState(false);
  const typeInfo = TYPE_STYLES[resource.type ?? ""] ?? {
    bg: "rgba(3,72,82,0.08)",
    color: "#034852",
    icon: "📎",
  };

  return (
    <div
      id={`resource-card-${resource.id}`}
      style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: hovered
          ? "1px solid rgba(10,190,98,0.4)"
          : "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        padding: "28px",
        boxShadow: hovered
          ? "0 16px 48px rgba(10,190,98,0.12)"
          : "0 8px 32px rgba(0,0,0,0.07)",
        cursor: "default",
        transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column" as const,
        gap: "14px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Badges row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
        {/* Type badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 12px",
            borderRadius: "100px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            background: typeInfo.bg,
            color: typeInfo.color,
          }}
        >
          <span>{typeInfo.icon}</span>
          {resource.type ?? "FILE"}
        </span>

        {/* Programme badge */}
        {resource.programme_type && (
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "100px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              background: "rgba(32,147,121,0.12)",
              color: "#209379",
            }}
          >
            {resource.programme_type}
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "17px",
          fontWeight: 700,
          color: "#034852",
          margin: 0,
          lineHeight: 1.35,
        }}
      >
        {resource.title}
      </h3>

      {/* Description */}
      {resource.description && (
        <p
          style={{
            fontSize: "13px",
            color: "rgba(3,72,82,0.6)",
            lineHeight: 1.6,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {resource.description}
        </p>
      )}

      {/* Open button */}
      <div style={{ marginTop: "auto", paddingTop: "4px" }}>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          id={`open-resource-${resource.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 20px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
            color: "#fff",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "12px",
            letterSpacing: "0.03em",
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
            transition: "all 200ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 6px 16px rgba(10,190,98,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(10,190,98,0.2)";
          }}
        >
          Open
          <span style={{ fontSize: "14px" }}>↗</span>
        </a>
      </div>
    </div>
  );
}

// ── Create Resource Form ───────────────────────────────────────

function CreateResourceForm({
  userId,
  roleCode,
  onCreated,
}: {
  userId: string;
  roleCode: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("PDF");
  const [programmeType, setProgrammeType] = useState("UG");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createResource({
        title: title.trim(),
        description: description.trim() || undefined,
        url: url.trim(),
        type,
        programme_type: programmeType,
        uploaded_by: userId,
        role: roleCode,
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create resource."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        ...glassCard,
        textAlign: "left",
        marginBottom: "28px",
        animation: "floatIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        opacity: 0,
        transform: "translateY(12px)",
      }}
    >
      <p style={labelStyle}>Add New Resource</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
        <div style={{ display: "grid", gap: "16px" }}>
          {/* Title */}
          <div>
            <label style={formLabelStyle}>Title *</label>
            <input
              id="resource-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. UPSC Prelims Notes"
              required
              style={formInputStyle}
            />
          </div>

          {/* URL */}
          <div>
            <label style={formLabelStyle}>URL *</label>
            <input
              id="resource-url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
              style={formInputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={formLabelStyle}>Description</label>
            <textarea
              id="resource-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              style={{ ...formInputStyle, resize: "vertical" as const }}
            />
          </div>

          {/* Row: Type / Programme */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={formLabelStyle}>Type</label>
              <select
                id="resource-type-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={formInputStyle}
              >
                <option value="PDF">PDF</option>
                <option value="VIDEO">Video</option>
                <option value="LINK">Link</option>
                <option value="DOC">Document</option>
              </select>
            </div>

            <div>
              <label style={formLabelStyle}>Programme</label>
              <select
                id="resource-programme-select"
                value={programmeType}
                onChange={(e) => setProgrammeType(e.target.value)}
                style={formInputStyle}
              >
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <p
            style={{
              marginTop: "12px",
              fontSize: "13px",
              color: "#e53e3e",
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}

        <button
          id="resource-submit-btn"
          type="submit"
          disabled={submitting || !title.trim() || !url.trim()}
          style={{
            ...primaryButton,
            marginTop: "20px",
            opacity: submitting || !title.trim() || !url.trim() ? 0.6 : 1,
            cursor:
              submitting || !title.trim() || !url.trim()
                ? "not-allowed"
                : "pointer",
          }}
        >
          {submitting ? "Adding…" : "Add Resource"}
        </button>
      </form>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function LoadingState() {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={glassCard}>
        <p style={labelStyle}>Loading</p>
        <p
          style={{
            marginTop: "12px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#034852",
          }}
        >
          Fetching resources
        </p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>
          Loading study materials&hellip;
        </p>
      </div>
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px",
  padding: "40px 48px",
  textAlign: "center",
  boxShadow: "0 32px 64px rgba(0,0,0,0.1)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "22px",
  fontWeight: 700,
  color: "#034852",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const primaryButton: React.CSSProperties = {
  padding: "12px 24px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
  whiteSpace: "nowrap",
};

const formLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "rgba(3,72,82,0.7)",
  marginBottom: "6px",
};

const formInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: "12px",
  color: "#034852",
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  outline: "none",
  transition: "border-color 200ms, box-shadow 200ms",
};
