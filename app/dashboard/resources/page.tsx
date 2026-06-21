"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createResource, type Resource } from "@/lib/api";
import { useResources, useUpdateResource, useDeleteResource } from "@/lib/queries/resources";
import { useQueryClient } from "@tanstack/react-query";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { BatchMultiPicker } from "@/components/BatchMultiPicker";
import type { RoleCode } from "@/lib/moduleAccess";

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

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const queryClient = useQueryClient();

  const roleCode = (data?.role?.code ?? "STUDENT") as RoleCode;
  const programmeType = data?.user?.programme ?? null;
  const canCreate = usePermission(PERM.resources.create);

  const resourceFilter =
    roleCode === "STUDENT" && programmeType ? programmeType : undefined;
  const { data: resources = [], isPending, error: queryError } = useResources(resourceFilter);
  const loading = isPending;
  const error = queryError ? (queryError as Error).message : null;

  if (userLoading) {
    return <LoadingState />;
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
            onClick={() => {
              setShowForm((prev) => !prev);
              setEditing(null);
            }}
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
            void queryClient.invalidateQueries({ queryKey: ["og", "resources"] });
          }}
        />
      )}

      {/* ── Edit form ───────────────────────────────────────── */}
      {editing && (
        <EditResourceForm
          resource={editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
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
            <ResourceCard
              key={r.id}
              resource={r}
              onEdit={(res) => {
                setEditing(res);
                setShowForm(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resource Card ──────────────────────────────────────────────

function ResourceCard({
  resource,
  onEdit,
}: {
  resource: Resource;
  onEdit: (resource: Resource) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canEdit = usePermission(PERM.resources.edit);
  const canDelete = usePermission(PERM.resources.delete);
  const { mutate: doDelete, isPending: deleting } = useDeleteResource();
  const typeInfo = TYPE_STYLES[resource.type ?? ""] ?? {
    bg: "rgba(3,72,82,0.08)",
    color: "#034852",
    icon: "📎",
  };

  return (
    <div
      id={`resource-card-${resource.id}`}
      style={{
        background: "#ffffff",
        border: hovered
          ? "1px solid rgba(10,190,98,0.4)"
          : "1px solid rgba(255,255,255,0.4)",
        borderRadius: "24px",
        padding: "28px",
        boxShadow: hovered
          ? "0 16px 48px rgba(10,190,98,0.12)"
          : "0 2px 8px rgba(0,0,0,0.05)",
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

      {/* Footer: Open + Edit buttons */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "4px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
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

        {canEdit && (
          <button
            id={`edit-resource-${resource.id}`}
            onClick={() => onEdit(resource)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "8px 16px",
              borderRadius: "10px",
              background: "rgba(3,72,82,0.06)",
              border: "1px solid rgba(3,72,82,0.14)",
              color: "#034852",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "12px",
              letterSpacing: "0.03em",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(3,72,82,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(3,72,82,0.06)"; }}
          >
            ✏️ Edit
          </button>
        )}

        {canDelete && !confirmDelete && (
          <button
            id={`delete-resource-${resource.id}`}
            onClick={() => setConfirmDelete(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "8px 16px",
              borderRadius: "10px",
              background: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.14)",
              color: "#dc2626",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "12px",
              letterSpacing: "0.03em",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; }}
          >
            🗑 Delete
          </button>
        )}

        {canDelete && confirmDelete && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
              Delete?
            </span>
            <button
              id={`confirm-delete-resource-${resource.id}`}
              onClick={() => doDelete(resource.id, { onSettled: () => setConfirmDelete(false) })}
              disabled={deleting}
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                border: "none",
                background: "#dc2626",
                color: "#fff",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "11px",
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(3,72,82,0.2)",
                background: "transparent",
                color: "#034852",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              No
            </button>
          </div>
        )}
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
  const [programmeType, setProgrammeType] = useState("ALL");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate();

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
        // "ALL" → null on the backend = visible to every programme.
        programme_type: programmeType === "ALL" ? undefined : programmeType,
        batch_ids: batchIds.length > 0 ? batchIds : undefined,
        uploaded_by: userId,
        role: roleCode,
      });
      invalidate('resources');
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
        <ResourceFormFields
          title={title} setTitle={setTitle}
          url={url} setUrl={setUrl}
          description={description} setDescription={setDescription}
          type={type} setType={setType}
          programmeType={programmeType} setProgrammeType={setProgrammeType}
          batchIds={batchIds} setBatchIds={setBatchIds}
        />

        {error && (
          <p style={{ marginTop: "12px", fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>
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
            cursor: submitting || !title.trim() || !url.trim() ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Adding…" : "Add Resource"}
        </button>
      </form>
    </div>
  );
}

// ── Edit Resource Form ─────────────────────────────────────────

function EditResourceForm({
  resource,
  onSaved,
  onCancel,
}: {
  resource: Resource;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(resource.title);
  const [description, setDescription] = useState(resource.description ?? "");
  const [url, setUrl] = useState(resource.url);
  const [type, setType] = useState(resource.type ?? "PDF");
  const [programmeType, setProgrammeType] = useState(resource.programme_type ?? "ALL");
  const [batchIds, setBatchIds] = useState<string[]>(resource.batch_ids ?? []);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useUpdateResource();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await mutateAsync({
        id: resource.id,
        payload: {
          title: title.trim(),
          description: description.trim() || undefined,
          url: url.trim(),
          type,
          programme_type: programmeType === "ALL" ? undefined : programmeType,
          batch_ids: batchIds.length > 0 ? batchIds : undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update resource.");
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={labelStyle}>Edit Resource</p>
        <button
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "18px",
            color: "rgba(3,72,82,0.5)",
            lineHeight: 1,
          }}
          aria-label="Cancel edit"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
        <ResourceFormFields
          title={title} setTitle={setTitle}
          url={url} setUrl={setUrl}
          description={description} setDescription={setDescription}
          type={type} setType={setType}
          programmeType={programmeType} setProgrammeType={setProgrammeType}
          batchIds={batchIds} setBatchIds={setBatchIds}
        />

        {error && (
          <p style={{ marginTop: "12px", fontSize: "13px", color: "#e53e3e", fontWeight: 600 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
          <button
            id="resource-save-btn"
            type="submit"
            disabled={isPending || !title.trim() || !url.trim()}
            style={{
              ...primaryButton,
              opacity: isPending || !title.trim() || !url.trim() ? 0.6 : 1,
              cursor: isPending || !title.trim() || !url.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "12px 24px",
              border: "1px solid rgba(3,72,82,0.2)",
              borderRadius: "12px",
              background: "transparent",
              color: "#034852",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared form fields ─────────────────────────────────────────

function ResourceFormFields({
  title, setTitle,
  url, setUrl,
  description, setDescription,
  type, setType,
  programmeType, setProgrammeType,
  batchIds, setBatchIds,
}: {
  title: string; setTitle: (v: string) => void;
  url: string; setUrl: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  type: string; setType: (v: string) => void;
  programmeType: string; setProgrammeType: (v: string) => void;
  batchIds: string[]; setBatchIds: (v: string[]) => void;
}) {
  return (
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
            <option value="ALL">All programmes</option>
            <option value="UG">UG</option>
            <option value="PG">PG</option>
          </select>
        </div>
      </div>

      {/* Batches */}
      <div>
        <label style={formLabelStyle}>Target Batches (optional — empty = everyone)</label>
        <BatchMultiPicker value={batchIds} onChange={setBatchIds} inputStyle={formInputStyle} />
      </div>
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
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "24px",
  padding: "40px 48px",
  textAlign: "center",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
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
