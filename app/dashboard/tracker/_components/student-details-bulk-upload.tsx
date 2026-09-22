"use client";

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useStudentFields } from '@/lib/queries/tracker';
import { previewStudentImport, commitStudentImport } from '@/lib/student-details-import-api';
import { buildStudentImport, readStudentCsv, downloadStudentImportReport,
  type StudentCsv, type StudentImportRequest, type StudentImportRow, type StudentImportResult } from '@/lib/student-details-import';

const control = 'min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50';
const primary = 'min-h-11 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50';
const steps = ['Upload', 'Choose fields', 'Match students', 'Review'];
const fieldTypes: Record<string, string> = { text: 'Text', number: 'Number', date: 'Date', select: 'Choice', multiselect: 'Multiple choices', boolean: 'Yes/no', url: 'Link' };
const rowStatuses: Record<StudentImportRow['status'], string> = { ready: 'Ready', invalid: 'Needs fixing', duplicate: 'Duplicate', unmatched: 'Not found', unchanged: 'No changes', saved: 'Updated' };
const showValue = (value: unknown): string => value == null ? 'Empty' : Array.isArray(value) ? value.join('; ') : String(value);

export function StudentDetailsBulkUpload({ onClose }: { onClose: () => void }) {
  const fieldsQuery = useStudentFields('active');
  const fields = fieldsQuery.data?.fields ?? [];
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [csv, setCsv] = useState<StudentCsv | null>(null);
  const [filename, setFilename] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [identifierColumn, setIdentifierColumn] = useState(-1);
  const [identifierType, setIdentifierType] = useState<StudentImportRequest['identifier_type']>('student_id');
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState<StudentImportRow[]>([]);
  const [request, setRequest] = useState<StudentImportRequest | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [school, setSchool] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StudentImportResult | null>(null);
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const mapped = Object.values(mapping).filter(Boolean);
  const mappingValid = mapped.length > 0 && mapped.length <= 50 && new Set(mapped).size === mapped.length;
  const eligible = preview.filter(row => row.status === 'ready');
  const schools = [...new Set(preview.map(row => row.school_name).filter((s): s is string => !!s))].sort();
  const shown = useMemo(() => preview.filter(row => (!school || row.school_name === school)
    && `${row.student_name ?? ''} ${row.identifier} ${row.school_name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [preview, school, search]);
  const count = selected.size;

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true); setError(null); setCsv(null); setMapping({}); setIdentifierColumn(-1); setPreview([]); setSelected(new Set()); setRequest(null);
    try { setCsv(await readStudentCsv(file)); setFilename(file.name); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not read CSV.'); }
    finally { setBusy(false); }
  }
  async function match() {
    if (!csv) return;
    setBusy(true); setError(null); setPreview([]); setSelected(new Set()); setSearch(''); setSchool('');
    try {
      const body = buildStudentImport(csv, mapping, identifierColumn, identifierType, overwrite);
      const response = await previewStudentImport(body);
      setRequest(body); setPreview(response.rows); setStep(3);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not match students.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!request || !count) return;
    setBusy(true); setError(null);
    try {
      const response = await commitStudentImport({ ...request, selected: eligible.filter(row => selected.has(row.row_number))
        .map(row => ({ row_number: row.row_number, student_id: row.student_id! })) });
      setResult(response);
      void queryClient.invalidateQueries({ queryKey: ['og', 'tracker'] });
    } catch (error) {
      setError(`${error instanceof Error ? error.message : 'Could not finish the upload.'} Some changes may be saved. Go back and match students again before retrying.`);
      setRequest(null); setSelected(new Set());
    } finally { setBusy(false); }
  }
  function back() { setError(null); setPreview([]); setSelected(new Set()); setRequest(null); setStep(s => s - 1); }
  function toggle(row: number) { setSelected(current => { const next = new Set(current); if (next.has(row)) next.delete(row); else next.add(row); return next; }); }

  return <Modal title={<h2 className="text-lg font-semibold text-[var(--color-text)]">Bulk upload</h2>} onClose={close} maxWidth="1000px">
    <div className="flex max-h-[75dvh] min-h-0 flex-col gap-4">
      {!result && <ol aria-label="Upload progress" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}
          className={`border-b-2 pb-2 ${step === index ? 'border-teal-600 font-semibold text-teal-800' : 'border-gray-200 text-gray-500'}`}>{index + 1}. {label}</li>)}
      </ol>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm text-[var(--teal)]"><Loader2 className="h-4 w-4 animate-spin" />{step === 3 ? 'Saving…' : step === 2 ? 'Finding students…' : 'Reading CSV…'}</p>}
      <div className="min-h-0 overflow-auto">
        {result ? <div className="space-y-4">
          <p role="status" className="text-lg font-semibold text-[var(--teal)]">{result.saved} {result.saved === 1 ? 'student updated' : 'students updated'}</p>
          {result.rows.length > result.saved && <p className="text-sm text-[var(--color-text-muted)]">{result.rows.length - result.saved} skipped. See details below.</p>}
          <ReviewTable rows={result.rows} />
          <button className={control} onClick={() => downloadStudentImportReport(result.rows)}>Download results</button>
        </div> : <>
          {step === 0 && <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Include a student ID or roll number and the details to update.</p>
            <label className="block text-sm font-medium">CSV file<input aria-label="CSV file" type="file" accept=".csv,text/csv" disabled={busy}
              className="mt-2 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-[var(--color-success-surface)] file:px-4 file:text-[var(--teal)]"
              onChange={event => { void pick(event.target.files?.[0]); event.target.value = ''; }} /></label>
            <p className="text-xs text-[var(--color-text-muted)]">Max. 1,000 rows · 2 MB</p>
            {csv && <><p className="text-sm font-medium">{filename} · {csv.rows.length} rows · {csv.headers.length} columns</p>
              <CsvPreview csv={csv} /></>}
          </div>}
          {step === 1 && csv && <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Match columns to fields. Skip any you don’t need.</p>
            {fieldsQuery.isLoading ? <p role="status">Loading fields…</p> : fieldsQuery.error ? <p role="alert">Could not load fields. <button className="underline" onClick={() => void fieldsQuery.refetch()}>Retry</button></p> : !fields.length ? <p>No fields yet. Ask your Program Manager to add them in Field Setup.</p> :
              <div className="divide-y divide-[var(--color-border)]">{csv.headers.map((header, i) => {
                const field = fields.find(f => f.field_key === mapping[String(i)]);
                return <div key={header} className="grid gap-2 py-3 sm:grid-cols-2 sm:items-center">
                  <div><p className="text-sm font-medium">{header}</p><p className="max-w-80 truncate text-xs text-[var(--color-text-muted)]">Example: {csv.rows[0]?.cells[i] || 'Empty'}</p></div>
                  <div><select aria-label={`Map ${header}`} className={`${control} w-full`} value={mapping[String(i)] ?? ''}
                    onChange={event => setMapping(current => ({ ...current, [i]: event.target.value }))}>
                    <option value="">Skip this column</option>{fields.map(f => <option key={f.id} value={f.field_key} disabled={mapped.includes(f.field_key) && mapping[String(i)] !== f.field_key}>{f.label} ({fieldTypes[f.field_type] ?? f.field_type})</option>)}
                  </select>{field?.options?.length ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">Options: {field.options.join('; ')}</p> : null}
                  {field?.field_type === 'date' && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Use YYYY-MM-DD.</p>}
                  {field?.field_type === 'boolean' && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Use yes/no, true/false, or 1/0.</p>}
                  {field?.field_type === 'multiselect' && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Separate choices with semicolons.</p>}</div>
                </div>;
              })}</div>}
          </div>}
          {step === 2 && csv && <div className="space-y-5">
            <p className="text-sm text-[var(--color-text-muted)]">Which column contains the student ID or roll number?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">CSV column<select aria-label="CSV column" disabled={busy} className={control} value={identifierColumn} onChange={e => setIdentifierColumn(Number(e.target.value))}>
                <option value={-1}>Choose a column</option>{csv.headers.map((h, i) => <option value={i} key={h}>{h}</option>)}
              </select></label>
              <label className="grid gap-2 text-sm font-medium">Contains<select aria-label="Contains" disabled={busy} className={control} value={identifierType} onChange={e => setIdentifierType(e.target.value as StudentImportRequest['identifier_type'])}>
                <option value="student_id">Student ID</option><option value="roll_number">Roll Number</option>
              </select></label>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">{identifierType === 'roll_number' ? 'Roll numbers must match exactly, including capitals and leading zeros.' : 'Use the student ID from OpenGrad.'}</p>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={busy} checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />Replace existing details</label>
            <p className="text-xs text-[var(--color-text-muted)]">{overwrite ? 'Blank cells won’t erase existing details.' : 'Only fills empty fields. Blank cells are skipped.'}</p>
          </div>}
          {step === 3 && <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">{eligible.length} ready · {preview.length - eligible.length} skipped · {count} selected</p>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Search matched students" placeholder="Search students" className={`${control} min-w-0 flex-1`} value={search} onChange={e => setSearch(e.target.value)} disabled={busy} />
              <select aria-label="Filter by school" className={control} value={school} onChange={e => setSchool(e.target.value)} disabled={busy}><option value="">All schools</option>{schools.map(s => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="flex flex-wrap items-center gap-2"><button className={control} disabled={busy || !eligible.length} onClick={() => setSelected(new Set(eligible.map(r => r.row_number)))}>Select all ready</button>
              <button className={control} disabled={busy || !count} onClick={() => setSelected(new Set())}>Clear</button>{(school || search) && <span className="text-xs text-[var(--color-text-muted)]">Includes students hidden by filters.</span>}</div>
            <ReviewTable rows={shown} selected={selected} toggle={toggle} disabled={busy} />
            {!shown.length && <p className="text-sm text-[var(--color-text-muted)]">No matches.</p>}
            {preview.some(r => r.status !== 'ready') && <button className="min-h-11 text-sm text-[var(--teal)] underline" onClick={() => downloadStudentImportReport(preview.filter(r => r.status !== 'ready'))}>Download skipped rows</button>}
          </div>}
        </>}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
        {result ? <><span /><button className={primary} onClick={close}>Done</button></> : <>
          <button className={control} disabled={busy} onClick={step ? back : close}>{step ? 'Back' : 'Cancel'}</button>
          {step < 2 ? <button className={primary} disabled={busy || (step === 0 ? !csv : !mappingValid || !!fieldsQuery.error || fieldsQuery.isLoading)} onClick={() => setStep(s => s + 1)}>Next</button>
            : step === 2 ? <button className={primary} disabled={busy || identifierColumn < 0} onClick={() => void match()}>Match students</button>
              : <button className={primary} disabled={busy || !count || !request} onClick={() => void save()}>Update {count} {count === 1 ? 'student' : 'students'}</button>}
        </>}
      </footer>
    </div>
  </Modal>;
}

function ReviewTable({ rows, selected, toggle, disabled }: { rows: StudentImportRow[]; selected?: Set<number>; toggle?: (row: number) => void; disabled?: boolean }) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
  return <><div tabIndex={0} role="region" aria-label="Student import review" className="max-h-80 overflow-auto rounded-lg border border-[var(--color-border)]">
    <table className="w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-[#eef5f3]"><tr>{toggle && <th className="p-3"><span className="sr-only">Select</span></th>}<th className="p-3">Student</th><th className="p-3">Changes</th><th className="p-3">Status</th></tr></thead>
      <tbody>{rows.slice(current * 25, (current + 1) * 25).map(row => <tr key={row.row_number} className="border-t border-[var(--color-border)] align-top">
        {toggle && <td className="p-3">{row.status === 'ready' && <label className="flex min-h-11 min-w-11 items-center justify-center"><input type="checkbox" aria-label={`Select ${row.student_name ?? row.identifier}`} checked={selected?.has(row.row_number) ?? false} disabled={disabled} onChange={() => toggle(row.row_number)} /></label>}</td>}
        <td className="p-3"><p className="font-medium">{row.student_name ?? row.identifier}</p><p className="text-xs text-[var(--color-text-muted)]">Row {row.row_number} · {row.identifier}</p>{row.school_name && <p className="text-xs text-[var(--color-text-muted)]">{row.school_name}</p>}</td>
        <td className="min-w-48 p-3">{row.changes.map(change => <div key={change.field_key} className="mb-2 max-w-sm break-words text-xs"><span className="font-medium">{change.label}: </span>{showValue(change.previous)} → <span className="text-[var(--teal)]">{showValue(change.value)}</span></div>)}{row.messages.map(message => <p key={message} className="max-w-sm text-xs text-[var(--color-text-muted)]">{message}</p>)}</td>
        <td className="p-3 text-xs">{rowStatuses[row.status]}</td>
      </tr>)}</tbody></table>
  </div><PreviewPages page={current} setPage={setPage} total={rows.length} label="review" disabled={disabled} /></>;
}

function CsvPreview({ csv }: { csv: StudentCsv }) {
  const [page, setPage] = useState(0);
  return <><div tabIndex={0} role="region" aria-label="CSV data preview" className="max-h-72 overflow-auto rounded-lg border border-[var(--color-border)]">
    <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#eef5f3]"><tr><th className="p-2">Row</th>{csv.headers.map(h => <th key={h} className="whitespace-nowrap p-2">{h}</th>)}</tr></thead>
      <tbody>{csv.rows.slice(page * 25, (page + 1) * 25).map(row => <tr key={row.row_number} className="border-t border-[var(--color-border)]"><td className="p-2 text-[var(--color-text-muted)]">{row.row_number}</td>{row.cells.map((cell, i) => <td key={i} className="max-w-64 whitespace-pre-wrap break-words p-2">{cell}</td>)}</tr>)}</tbody></table>
  </div><PreviewPages page={page} setPage={setPage} total={csv.rows.length} label="preview" /></>;
}

function PreviewPages({ page, setPage, total, label, disabled }: { page: number; setPage: (page: number) => void; total: number; label: string; disabled?: boolean }) {
  if (total <= 25) return null;
  return <div className="flex items-center justify-between gap-2 pt-2 text-xs text-[var(--color-text-muted)]">
    <button className={control} disabled={disabled || !page} onClick={() => setPage(page - 1)} aria-label={`Previous ${label} page`}>Previous</button>
    <span>Showing {page * 25 + 1}–{Math.min((page + 1) * 25, total)} of {total}</span>
    <button className={control} disabled={disabled || (page + 1) * 25 >= total} onClick={() => setPage(page + 1)} aria-label={`Next ${label} page`}>Next</button>
  </div>;
}
