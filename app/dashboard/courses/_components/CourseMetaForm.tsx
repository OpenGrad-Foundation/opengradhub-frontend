"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { Course } from "@/lib/api";

type FormFields = {
  title: string;
  description: string;
  programme_type: string;
  cover_image_url: string;
  locking_mode: string;
  access_type: string;
  tags: string[];
};

type Props = {
  initial?: Course;
  embedded?: boolean;
  onSave: (fields: FormFields) => Promise<void>;
  submitLabel: string;
};

export default function CourseMetaForm({ initial, onSave, submitLabel, embedded = false }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [programmeType, setProgrammeType] = useState(initial?.programme_type ?? "UG");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.cover_image_url ?? "");
  const [lockingMode, setLockingMode] = useState(initial?.locking_mode ?? "OPEN");
  const [accessType, setAccessType] = useState(initial?.access_type ?? "FREE");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        programme_type: programmeType,
        cover_image_url: coverImageUrl.trim(),
        locking_mode: lockingMode,
        access_type: accessType,
        tags: tags,
      });
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="course-mgmt-form">
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .course-mgmt-form-card {
            gap: 18px !important;
          }
          .course-mgmt-form-flex-row {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .course-mgmt-form-flex-row button,
          .course-mgmt-form-flex-row label {
            width: 100% !important;
            flex: none !important;
          }
        }
      ` }} />
      <div className="course-mgmt-form-card" style={embedded ? { ...card, background: "transparent", border: 0, padding: 0, boxShadow: "none" } : card}>

        {/* ── Title ─────────────────────────────────────────── */}
        <Section label="Title *">
          <input
            id="course-title" aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Data Science"
            required
            style={inputStyle}
          />
        </Section>

        {/* ── Description ───────────────────────────────────── */}
        <Section label="Description">
          <textarea
            id="course-description" aria-label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students learn in this course?"
            rows={4}
            style={{ ...inputStyle, resize: "vertical" as const }}
          />
        </Section>

        {/* ── Tags ──────────────────────────────────────────── */}
        <Section label="Tags">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              padding: "8px",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "8px",
              background: "var(--color-surface)",
              minHeight: "44px",
              alignItems: "center"
            }}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(10,190,98,0.1)",
                  color: "var(--color-text)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    color: "var(--teal)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} strokeWidth={3} aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              id="course-tags" aria-label="Tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const val = tagInput.trim().toUpperCase();
                  if (val && !tags.includes(val)) {
                    setTags([...tags, val]);
                  }
                  setTagInput("");
                } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                  setTags(tags.slice(0, -1));
                }
              }}
              placeholder={tags.length === 0 ? "Type and press Enter to add tags" : ""}
              style={{
                flex: 1,
                minWidth: "120px",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "14px",
                color: "var(--color-text)",
                fontFamily: "inherit",
              }}
            />
          </div>
        </Section>

        {/* ── Programme Type ────────────────────────────────── */}
        <Section label="Programme type">
          <div className="course-mgmt-form-flex-row" style={{ display: "flex", gap: "12px" }}>
            {(["UG", "PG"] as const).map((p) => (
              <ToggleChip
                key={p}
                label={p}
                active={programmeType === p}
                onClick={() => setProgrammeType(p)}
              />
            ))}
          </div>
        </Section>

        {/* ── Cover Image URL ───────────────────────────────── */}
        <Section label="Cover image URL">
          <input
            id="course-cover-url" aria-label="Cover image URL"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://… (leave blank for default cover)"
            style={inputStyle}
          />
          {coverImageUrl && (
            <div
              style={{
                marginTop: "12px",
                height: "120px",
                borderRadius: "12px",
                background: `url(${coverImageUrl}) center/cover no-repeat`,
                border: "1px solid var(--color-border)",
              }}
            />
          )}
        </Section>

        {/* ── Locking Mode ──────────────────────────────────── */}
        <Section label="Locking mode">
          <div className="course-mgmt-form-flex-row" style={{ display: "flex", gap: "12px" }}>
            <ToggleChip
              label="Open"
              sublabel="Students can take any lesson in any order"
              active={lockingMode === "OPEN"}
              onClick={() => setLockingMode("OPEN")}
            />
            <ToggleChip
              label="Sequential"
              sublabel="Must complete lessons in order"
              active={lockingMode === "SEQUENTIAL"}
              onClick={() => setLockingMode("SEQUENTIAL")}
            />
          </div>
        </Section>

        {/* ── Access Type ───────────────────────────────────── */}
        <Section label="Access type">
          <div className="course-mgmt-form-flex-row" style={{ display: "flex", gap: "12px" }}>
            <RadioCard
              id="access-free"
              label="Free"
              sublabel="Available to all enrolled students"
              checked={accessType === "FREE"}
              onChange={() => setAccessType("FREE")}
            />
            <RadioCard
              id="access-paid"
              label="Paid"
              sublabel="Requires payment or special access"
              checked={accessType === "PAID"}
              onChange={() => setAccessType("PAID")}
            />
          </div>
        </Section>

        {error && (
          <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginTop: "4px" }}>
            {error}
          </p>
        )}

        {/* ── Submit ────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
          <button
            id="course-save-btn"
            type="submit"
            disabled={submitting || !title.trim()}
            style={{
              ...primaryButton,
              opacity: submitting || !title.trim() ? 0.6 : 1,
              cursor: submitting || !title.trim() ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function ToggleChip({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        minHeight: "44px",
        padding: sublabel ? "12px 16px" : "8px 16px",
        border: active ? "1px solid var(--green)" : "1px solid var(--color-border)",
        borderRadius: "12px",
        background: active ? "rgba(10,190,98,0.08)" : "var(--color-surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 180ms ease",
      }}
    >
      <span style={{
        display: "block",
        fontWeight: 600,
        fontSize: "14px",
        color: active ? "var(--color-text)" : "var(--color-text-muted)",
      }}>
        {label}
      </span>
      {sublabel && (
        <span style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)", marginTop: "3px" }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

function RadioCard({
  id,
  label,
  sublabel,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  sublabel: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 18px",
        border: checked ? "1px solid var(--green)" : "1px solid var(--color-border)",
        borderRadius: "12px",
        background: checked ? "rgba(10,190,98,0.08)" : "var(--color-surface)",
        cursor: "pointer",
        transition: "all 180ms ease",
      }}
    >
      <input
        id={id}
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: "3px", accentColor: "#08784a" }}
      />
      <span>
        <span style={{
          display: "block",
          fontWeight: 600,
          fontSize: "14px",
          color: "var(--color-text)",
        }}>
          {label}
        </span>
        <span style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)", marginTop: "3px" }}>
          {sublabel}
        </span>
      </span>
    </label>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px, 4vw, 24px)",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const inputStyle: React.CSSProperties = {
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

const fieldLabel: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
};

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "8px 20px",
  border: "1px solid var(--green)",
  borderRadius: "12px",
  background: "var(--green)",
  color: "var(--dark-teal)",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};
