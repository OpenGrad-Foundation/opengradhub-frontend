"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Link2, Paperclip, Pencil, PlayCircle, Plus, Trash2, X } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createResource, type Resource } from "@/lib/api";
import { useResources, useUpdateResource, useDeleteResource } from "@/lib/queries/resources";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { BatchMultiPicker } from "@/components/BatchMultiPicker";
import { SchoolMultiPicker } from "@/components/SchoolMultiPicker";
import { fetchTargetableSchools } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";

// ── Type → colour mapping ──────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  PDF:   { bg: "rgba(184,50,50,0.08)", color: "#b83232", icon: <FileText size={14} aria-hidden="true" /> },
  VIDEO: { bg: "var(--color-success-surface)", color: "#08784a", icon: <PlayCircle size={14} aria-hidden="true" /> },
  LINK:  { bg: "rgba(0,109,108,0.10)", color: "#006d6c", icon: <Link2 size={14} aria-hidden="true" /> },
  DOC:   { bg: "rgba(59,130,246,0.10)", color: "#2563eb", icon: <FileText size={14} aria-hidden="true" /> },
};

// ── Page ───────────────────────────────────────────────────────

export default function ResourcesPage() {
  return <Suspense fallback={<LoadingState />}><ResourcesPageContent /></Suspense>;
}

function ResourcesPageContent() {
  const params = useSearchParams();
  const focus = params.get("focus");
  const { data, isLoading: userLoading } = useCurrentUser();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const queryClient = useQueryClient();

  const roleCode = (data?.role?.code ?? "STUDENT") as RoleCode;
  const canCreate = usePermission(PERM.resources.create);

  const { data: allResources = [], isPending, error: queryError } = useResources();
  const resources = focus ? allResources.filter(resource => resource.id === focus) : allResources;
  const loading = isPending;
  const error = queryError ? (queryError as Error).message : null;

  if (userLoading) {
    return <LoadingState />;
  }

  return (
    <div>
      <BackLink fallback="/dashboard" style={backLinkStyle}><ArrowLeft size={18} aria-hidden="true" />Back</BackLink>
      {focus && <p style={{ marginBlock: 12, fontSize: 14, color: "var(--color-text-muted)" }}>Selected resource · <Link href="/dashboard/resources">Show all resources</Link></p>}
      {/* ── Header ──────────────────────────────────────────── */}
      {canCreate && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            margin: "16px 0 24px",
          }}
        >
          <button
            id="add-resource-btn"
            onClick={() => {
              setShowForm((prev) => !prev);
              setEditing(null);
            }}
            style={showForm ? secondaryButton : primaryButton}
          >
            {showForm
              ? <><X size={18} aria-hidden="true" />Cancel</>
              : <><Plus size={18} aria-hidden="true" />Add Resource</>}
          </button>
        </div>
      )}

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
          <p role="alert" style={{ ...titleStyle, color: "#b83232", margin: 0 }}>{error}</p>
        </div>
      ) : resources.length === 0 ? (
        <div style={glassCard}>
          <p style={{ ...titleStyle, margin: 0 }}>
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
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "16px",
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Two independent gates, ANDed — the same split the server applies. The
  // permission answers "may this role edit resources at all"; the per-row flag
  // answers "this one". Showing a button on the permission alone puts an Edit
  // control on every card and 403s the moment it is clicked, which is how it
  // behaved while any PROGRAM_MANAGER could edit anything.
  const canEdit = usePermission(PERM.resources.edit) && resource.can_edit;
  const canDelete = usePermission(PERM.resources.delete) && resource.can_delete;
  const { mutate: doDelete, isPending: deleting } = useDeleteResource();
  const typeInfo = TYPE_STYLES[resource.type ?? ""] ?? {
    bg: "#eef5f3",
    color: "var(--color-text)",
    icon: <Paperclip size={14} aria-hidden="true" />,
  };

  return (
    <div
      id={`resource-card-${resource.id}`}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        padding: "clamp(16px,4vw,24px)",
        display: "flex",
        flexDirection: "column" as const,
        gap: "12px",
      }}
    >
      {/* Badges row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
        {/* Type badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            background: typeInfo.bg,
            color: typeInfo.color,
          }}
        >
          {typeInfo.icon}
          {resource.type ?? "FILE"}
        </span>

        {/* Programme badge */}
        {resource.programme_type && (
          <span
            style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              background: "#eef5f3",
              color: "var(--color-text-muted)",
            }}
          >
            {resource.programme_type}
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--color-text)",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {resource.title}
      </h3>

      {/* Description */}
      {resource.description && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
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
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          id={`open-resource-${resource.id}`}
          style={{ ...primaryButton, textDecoration: "none" }}
        >
          Open
          <ExternalLink size={16} aria-hidden="true" />
        </a>

        {canEdit && (
          <button
            id={`edit-resource-${resource.id}`}
            onClick={() => onEdit(resource)}
            style={secondaryButton}
          >
            <Pencil size={16} aria-hidden="true" />Edit
          </button>
        )}

        {canDelete && !confirmDelete && (
          <button
            id={`delete-resource-${resource.id}`}
            onClick={() => setConfirmDelete(true)}
            style={{ ...secondaryButton, color: "#b83232" }}
          >
            <Trash2 size={16} aria-hidden="true" />Delete
          </button>
        )}

        {canDelete && confirmDelete && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#b83232", fontWeight: 600 }}>
              Delete?
            </span>
            <button
              id={`confirm-delete-resource-${resource.id}`}
              onClick={() => doDelete(resource.id, { onSettled: () => setConfirmDelete(false) })}
              disabled={deleting}
              style={{
                ...primaryButton,
                border: "1px solid #b83232",
                background: "#b83232",
                color: "#fff",
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={secondaryButton}
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
  const [schoolIds, setSchoolIds] = useState<string[]>([]);
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
        school_ids: schoolIds.length > 0 ? schoolIds : undefined,
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
        marginBottom: "24px",
      }}
    >
      <h2 style={{ ...titleStyle, margin: 0 }}>Add New Resource</h2>

      <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
        <ResourceFormFields
          title={title} setTitle={setTitle}
          url={url} setUrl={setUrl}
          description={description} setDescription={setDescription}
          type={type} setType={setType}
          programmeType={programmeType} setProgrammeType={setProgrammeType}
          batchIds={batchIds} setBatchIds={setBatchIds}
          schoolIds={schoolIds} setSchoolIds={setSchoolIds}
        />

        {error && (
          <p role="alert" style={{ marginTop: "12px", fontSize: "14px", color: "#b83232", fontWeight: 600 }}>
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
  const [schoolIds, setSchoolIds] = useState<string[]>(resource.school_ids ?? []);
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
          school_ids: schoolIds.length > 0 ? schoolIds : undefined,
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
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ ...titleStyle, margin: 0 }}>Edit Resource</h2>
        <button
          onClick={onCancel}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "44px",
            minHeight: "44px",
            background: "none",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            color: "var(--color-text-muted)",
          }}
          aria-label="Cancel edit"
        >
          <X size={20} aria-hidden="true" />
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
          schoolIds={schoolIds} setSchoolIds={setSchoolIds}
        />

        {error && (
          <p role="alert" style={{ marginTop: "12px", fontSize: "14px", color: "#b83232", fontWeight: 600 }}>
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
            style={secondaryButton}
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
  schoolIds, setSchoolIds,
}: {
  title: string; setTitle: (v: string) => void;
  url: string; setUrl: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  type: string; setType: (v: string) => void;
  programmeType: string; setProgrammeType: (v: string) => void;
  batchIds: string[]; setBatchIds: (v: string[]) => void;
  schoolIds: string[]; setSchoolIds: (v: string[]) => void;
}) {
  // Same key and staleTime as every other school picker on the dashboard, so
  // opening this form reuses whatever the attendance or batch screens fetched.
  // A DIFFERENT key from the plain ["og","schools","options"] listing used by
  // the attendance and batch screens: this asks for the targeting scope, which
  // is a strictly smaller set. Sharing the key would let whichever screen
  // loaded first decide which set this picker shows.
  const { data: schools, isError: schoolsFailed, isLoading: schoolsLoading } = useQuery({
    queryKey: ["og", "schools", "options", "targeting"],
    queryFn: fetchTargetableSchools,
    staleTime: 5 * 60_000,
  });

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
            {PROGRAMME_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Targets. Both are optional and they OR together: naming either one
          narrows the audience, naming neither leaves it at everyone the
          programme filter above already allows. */}
      <div>
        <label style={formLabelStyle}>Target Batches (optional — empty = everyone)</label>
        <BatchMultiPicker value={batchIds} onChange={setBatchIds} inputStyle={formInputStyle} />
      </div>

      <div>
        <label style={formLabelStyle}>Target Schools (optional — reaches every student there)</label>
        {schoolsFailed ? (
          // GET /schools is gated by `user_management.create` OR `schools.view`,
          // neither of which is the permission that got the caller onto this
          // form. A role can legitimately hold one and not the other, so say so
          // rather than render an empty box that reads as broken.
          <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
            Your role cannot browse the school list — target batches instead.
          </p>
        ) : (
          <SchoolMultiPicker
            schools={schools ?? []}
            value={schoolIds}
            onChange={setSchoolIds}
            isLoading={schoolsLoading}
            inputStyle={formInputStyle}
          />
        )}
        {schoolIds.length > 0 && (
          <p style={{ margin: "6px 0 0", fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-muted)" }}>
            A school-targeted resource cannot be handed to a programme to manage — a school
            hosts programmes rather than belonging to one, so no programme can be said to
            bound who this reaches. Target batches instead if you need that.
          </p>
        )}
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
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--color-text)",
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
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "var(--color-text)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--color-text-muted)",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "44px",
  padding: "8px 16px",
  borderRadius: "12px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const primaryButton: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--green)",
  background: "var(--green)",
  color: "var(--dark-teal)",
};

const secondaryButton: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const backLinkStyle: React.CSSProperties = {
  ...secondaryButton,
  textDecoration: "none",
};

const formLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
  marginBottom: "6px",
};

const formInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "8px 12px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px",
  color: "var(--color-text)",
  fontSize: "14px",
  boxSizing: "border-box",
};
