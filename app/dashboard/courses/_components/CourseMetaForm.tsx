"use client";

import { useState } from "react";
import type { Course } from "@/lib/api";

type FormFields = {
  title: string;
  description: string;
  programme_type: string;
  cover_image_url: string;
  locking_mode: string;
  access_type: string;
};

type Props = {
  initial?: Course;
  onSave: (fields: FormFields) => Promise<void>;
  submitLabel: string;
};

export default function CourseMetaForm({ initial, onSave, submitLabel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [programmeType, setProgrammeType] = useState(initial?.programme_type ?? "UG");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.cover_image_url ?? "");
  const [lockingMode, setLockingMode] = useState(initial?.locking_mode ?? "OPEN");
  const [accessType, setAccessType] = useState(initial?.access_type ?? "FREE");
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={card}>

        {/* ── Title ─────────────────────────────────────────── */}
        <Section label="Title *">
          <input
            id="course-title"
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
            id="course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students learn in this course?"
            rows={4}
            style={{ ...inputStyle, resize: "vertical" as const }}
          />
        </Section>

        {/* ── Programme Type ────────────────────────────────── */}
        <Section label="Programme Type">
          <div style={{ display: "flex", gap: "12px" }}>
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
        <Section label="Cover Image URL">
          <input
            id="course-cover-url"
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
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            />
          )}
        </Section>

        {/* ── Locking Mode ──────────────────────────────────── */}
        <Section label="Locking Mode">
          <div style={{ display: "flex", gap: "12px" }}>
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
        <Section label="Access Type">
          <div style={{ display: "flex", gap: "12px" }}>
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
          <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginTop: "4px" }}>
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
      style={{
        flex: 1,
        padding: sublabel ? "14px 18px" : "10px 20px",
        border: active ? "2px solid #0abe62" : "2px solid rgba(3,72,82,0.12)",
        borderRadius: "12px",
        background: active ? "rgba(10,190,98,0.08)" : "rgba(255,255,255,0.6)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 180ms ease",
      }}
    >
      <span style={{
        display: "block",
        fontFamily: "var(--font-heading)",
        fontWeight: 700,
        fontSize: "14px",
        color: active ? "#034852" : "rgba(3,72,82,0.6)",
      }}>
        {label}
      </span>
      {sublabel && (
        <span style={{ display: "block", fontSize: "11px", color: "rgba(3,72,82,0.5)", marginTop: "3px" }}>
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
        border: checked ? "2px solid #0abe62" : "2px solid rgba(3,72,82,0.12)",
        borderRadius: "12px",
        background: checked ? "rgba(10,190,98,0.08)" : "rgba(255,255,255,0.6)",
        cursor: "pointer",
        transition: "all 180ms ease",
      }}
    >
      <input
        id={id}
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: "3px", accentColor: "#0abe62" }}
      />
      <span>
        <span style={{
          display: "block",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "14px",
          color: "#034852",
        }}>
          {label}
        </span>
        <span style={{ display: "block", fontSize: "11px", color: "rgba(3,72,82,0.5)", marginTop: "3px" }}>
          {sublabel}
        </span>
      </span>
    </label>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px",
  padding: "36px 40px",
  boxShadow: "0 32px 64px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(3,72,82,0.03)",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "12px",
  color: "#034852",
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "rgba(3,72,82,0.7)",
};

const primaryButton: React.CSSProperties = {
  padding: "13px 28px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 240ms cubic-bezier(0.16,1,0.3,1)",
};
