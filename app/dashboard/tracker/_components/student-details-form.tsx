"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save, X } from "lucide-react";
import { useSaveStudentDetails, useStudentDetails } from "@/lib/queries/tracker";
import {
  StudentDetailsValidationError,
  type TrackerStudentDetail,
  type TrackerStudentFieldDef,
} from "@/lib/tracker-api";

type FieldValues = Record<string, unknown>;

/**
 * Fellow-facing drawer to fill the PM-defined "Additional Student Details" for a
 * single student. Renders one control per active field def, saves via
 * PUT /tracker/students/:id/details, and surfaces per-field 400 errors inline.
 * A blank value clears any stored value (server contract).
 */
export function StudentDetailsForm({
  studentId,
  studentName,
  onClose,
  onSaved,
}: {
  studentId: string;
  studentName?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { data, isLoading, error } = useStudentDetails(studentId);
  const save = useSaveStudentDetails(studentId);

  const activeDetails = useMemo<TrackerStudentDetail[]>(
    () =>
      (data?.details ?? [])
        .filter((d) => d.field.status === "active")
        .sort((a, b) => a.field.sort_order - b.field.sort_order),
    [data],
  );

  const [values, setValues] = useState<FieldValues>({});
  const [initialised, setInitialised] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the editable values from the fetched details once they arrive.
  if (data && !initialised) {
    const seed: FieldValues = {};
    for (const d of activeDetails) seed[d.field.field_key] = normaliseValue(d.field, d.value);
    setValues(seed);
    setInitialised(true);
  }

  const setValue = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSaved(false);
  };

  async function onSubmit() {
    setFormError(null);
    setFieldErrors({});
    setSaved(false);
    // Send every active field so blanks clear stored values (server contract).
    const payload: FieldValues = {};
    for (const d of activeDetails) payload[d.field.field_key] = toPayload(d.field, values[d.field.field_key]);
    try {
      await save.mutateAsync(payload);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      if (err instanceof StudentDetailsValidationError) {
        setFieldErrors(err.fieldErrors);
        setFormError("Some fields need attention.");
      } else {
        setFormError(err instanceof Error ? err.message : "Could not save student details.");
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Student details"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-950">Student details</h3>
            {studentName && <p className="truncate text-xs text-gray-500">{studentName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load details."}</p>
        ) : activeDetails.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No additional detail fields have been set up yet. A Program Manager can add them from the tracker.
          </p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-4">
                {activeDetails.map((d) => (
                  <FieldInput
                    key={d.field.field_key}
                    field={d.field}
                    value={values[d.field.field_key]}
                    error={fieldErrors[d.field.field_key]}
                    onChange={(v) => setValue(d.field.field_key, v)}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100 p-3">
              {formError && (
                <p className="mb-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>
              )}
              {saved && !formError && (
                <p className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Saved.
                </p>
              )}
              <button
                type="button"
                onClick={onSubmit}
                disabled={save.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                Save details
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: TrackerStudentFieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const inputClass =
    "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  const errorClass = error ? " border-red-300 focus:border-red-500 focus:ring-red-100" : "";

  const control = () => {
    switch (field.field_type) {
      case "boolean":
        return (
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
            Yes
          </label>
        );
      case "number":
        return (
          <input
            type="number"
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass + errorClass}
          />
        );
      case "date":
        return (
          <input
            type="date"
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value || null)}
            className={inputClass + errorClass}
          />
        );
      case "select":
        return (
          <select value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)} className={inputClass + errorClass}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      case "multiselect": {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((o) => {
              const on = selected.includes(o);
              return (
                <label
                  key={o}
                  className={
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs " +
                    (on ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 text-gray-600")
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                  />
                  {o}
                </label>
              );
            })}
          </div>
        );
      }
      default:
        return (
          <input
            type={field.field_type === "url" ? "url" : "text"}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.field_type === "url" ? "https://…" : undefined}
            className={inputClass + errorClass}
          />
        );
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
      </label>
      {control()}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Coerce a stored value into the shape the corresponding control expects. */
function normaliseValue(field: TrackerStudentFieldDef, value: unknown): unknown {
  if (field.field_type === "multiselect") return Array.isArray(value) ? value : [];
  if (field.field_type === "boolean") return value === true;
  return value ?? "";
}

/** Normalise a control value into the payload shape; blanks become null to clear. */
function toPayload(field: TrackerStudentFieldDef, value: unknown): unknown {
  if (field.field_type === "multiselect") return Array.isArray(value) ? value : [];
  if (field.field_type === "boolean") return value === true;
  if (field.field_type === "number") return value === "" || value == null ? null : Number(value);
  if (value === "" || value == null) return null;
  return value;
}
