"use client";

import { useState } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import { useCreateStudentField, useStudentFields, useUpdateStudentField, useDeleteStudentField } from "@/lib/queries/tracker";
import { ApiError } from "@/lib/api";
import type { TrackerFieldType, TrackerStudentFieldDef } from "@/lib/tracker-api";

const FIELD_TYPES: TrackerFieldType[] = ["text", "number", "date", "select", "multiselect", "boolean", "url"];
const isChoiceType = (t: TrackerFieldType) => t === "select" || t === "multiselect";
const parseOptions = (text: string): string[] => text.split(",").map((o) => o.trim()).filter(Boolean);

const inputClass =
  "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

/**
 * PM panel to define/list/edit/archive the "Additional Student Details" field
 * definitions that templates can auto-fill via `student.custom.<field_key>`.
 * Gated by the same `canAuthor` signal the page uses for TrackerBuilder.
 */
export function StudentFieldsManager({ canAuthor }: { canAuthor: boolean }) {
  const [addingField, setAddingField] = useState(false);
  const active = useStudentFields("active", canAuthor);
  const archived = useStudentFields("archived", canAuthor);

  if (!canAuthor) return null;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-950">Additional Student Details</h3>
        <p className="mt-1 text-sm text-gray-500">
          Extra student fields (e.g. Date of Birth, Aadhaar URL) that Fellows fill and templates can auto-fill.
        </p>
      </div>

      {addingField ? (
        <div className="mb-6">
          <CreateFieldForm 
            nextSort={(active.data?.fields.length ?? 0)} 
            onSuccess={() => setAddingField(false)} 
            onCancel={() => setAddingField(false)} 
          />
        </div>
      ) : (
        <div className="mb-6">
          <button
            onClick={() => setAddingField(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Field
          </button>
        </div>
      )}

      <div>
        <h4 className="mb-3 text-sm font-semibold text-gray-950">Active fields</h4>
        {active.isLoading ? (
          <Loading />
        ) : active.error ? (
          <ErrorLine message={active.error instanceof Error ? active.error.message : "Failed to load fields."} />
        ) : (active.data?.fields.length ?? 0) === 0 ? (
          <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-4 text-sm text-gray-500">No fields yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-md border border-gray-200 bg-white">
            {[...(active.data?.fields ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((f) => (
                <FieldRow key={f.id} field={f} />
              ))}
          </ul>
        )}
      </div>

      {(archived.data?.fields.length ?? 0) > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-800">
            Archived fields ({archived.data?.fields.length})
          </summary>
          <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-md border border-gray-200 bg-white">
            {(archived.data?.fields ?? []).map((f) => (
              <FieldRow key={f.id} field={f} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CreateFieldForm({ nextSort, onSuccess, onCancel }: { nextSort: number; onSuccess: () => void; onCancel: () => void }) {
  const create = useCreateStudentField();
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<TrackerFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const [sortOrder, setSortOrder] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!label.trim()) {
      setErr("Add a label.");
      return;
    }
    const options = isChoiceType(fieldType) ? parseOptions(optionsText) : undefined;
    if (isChoiceType(fieldType) && (!options || options.length === 0)) {
      setErr("Add at least one choice.");
      return;
    }
    try {
      await create.mutateAsync({
        label: label.trim(),
        field_type: fieldType,
        options: options ?? null,
        required,
        sort_order: sortOrder.trim() === "" ? nextSort : Number(sortOrder),
      });
      onSuccess();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErr("A field with that name already exists. Pick a different label.");
      } else {
        setErr(e instanceof Error ? e.message : "Could not create the field.");
      }
    }
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <p className="mb-4 text-sm font-semibold text-gray-900">Add a new field</p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
          <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:flex-1">
            Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Date of Birth" className={inputClass} />
          </label>
          <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:w-40 md:shrink-0">
            Type
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value as TrackerFieldType)} className={inputClass}>
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {isChoiceType(fieldType) && (
            <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:flex-1">
              Choices (comma separated)
              <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="e.g. Option A, Option B" className={inputClass} />
            </label>
          )}
          <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:w-24 md:shrink-0">
            Order
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder={String(nextSort)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm font-medium text-gray-700 md:shrink-0">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-600" /> 
            Required
          </label>
        </div>
        
        {err && <p className="text-sm font-medium text-red-600">{err}</p>}
        
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-teal-900/20 bg-white px-5 py-2 text-[13px] font-semibold text-teal-950 transition-all hover:bg-teal-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0abe62] to-[#006d6c] px-6 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(10,190,98,0.2)] transition-all hover:opacity-90 disabled:opacity-70"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            Save field
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: TrackerStudentFieldDef }) {
  const update = useUpdateStudentField();
  const del = useDeleteStudentField();
  const [editing, setEditing] = useState(false);
  const isArchived = field.status === "archived";

  if (editing) {
    return <EditFieldRow field={field} onDone={() => setEditing(false)} />;
  }

  return (
    <li className={"flex flex-wrap items-center justify-between gap-2 px-3 py-3 " + (isArchived ? "bg-gray-50/60" : "")}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-950">
          {field.label}
          {field.required && (
            <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">Required</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {field.field_type}
          {isChoiceType(field.field_type) && field.options?.length ? ` · ${field.options.join(", ")}` : ""}
          {" · "}
          <span className="font-mono">{field.field_key}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!isArchived && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => update.mutate({ id: field.id, patch: { status: isArchived ? "active" : "archived" } })}
          disabled={update.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
          {isArchived ? "Unarchive" : "Archive"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this field permanently? This will remove all data stored for this field across all students.")) {
              del.mutate(field.id);
            }
          }}
          disabled={del.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
          Delete
        </button>
      </div>
    </li>
  );
}

function EditFieldRow({ field, onDone }: { field: TrackerStudentFieldDef; onDone: () => void }) {
  const update = useUpdateStudentField();
  const [label, setLabel] = useState(field.label);
  const [optionsText, setOptionsText] = useState((field.options ?? []).join(", "));
  const [required, setRequired] = useState(field.required);
  const [sortOrder, setSortOrder] = useState(String(field.sort_order));
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!label.trim()) {
      setErr("Add a label.");
      return;
    }
    const options = isChoiceType(field.field_type) ? parseOptions(optionsText) : undefined;
    if (isChoiceType(field.field_type) && (!options || options.length === 0)) {
      setErr("Add at least one choice.");
      return;
    }
    try {
      await update.mutateAsync({
        id: field.id,
        patch: {
          label: label.trim(),
          options: options ?? null,
          required,
          sort_order: Number(sortOrder) || 0,
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the field.");
    }
  }

  return (
    <li className="bg-teal-50/40 p-4">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
        <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:flex-1">
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </label>
        {isChoiceType(field.field_type) && (
          <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:flex-1">
            Choices (comma separated)
            <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} className={inputClass} />
          </label>
        )}
        <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-gray-700 md:w-24 md:shrink-0">
          Order
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm font-medium text-gray-700 md:shrink-0">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-600" /> 
          Required
        </label>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">Type ({field.field_type}) can&apos;t be changed after creation.</p>
        <div className="flex items-center gap-3">
          {err && <p className="mr-2 text-sm font-medium text-red-600">{err}</p>}
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-teal-900/20 bg-white px-4 py-2 text-[13px] font-semibold text-teal-950 transition-all hover:bg-teal-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={update.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0abe62] to-[#006d6c] px-5 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(10,190,98,0.2)] transition-all hover:opacity-90 disabled:opacity-70"
          >
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save changes
          </button>
        </div>
      </div>
    </li>
  );
}

function Loading() {
  return (
    <div className="flex min-h-20 items-center justify-center rounded-md border border-gray-100 bg-gray-50">
      <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-800">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> {message}
    </p>
  );
}
