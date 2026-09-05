"use client";
import { useEffect, useId, useState } from "react";
import { getStudentCreationDestinations, type StudentCreationDestinations } from "@/lib/api";

export type StudentDestination = { programme_id?: string; batch_id?: string };
export function StudentCreationDestination({ value, onChange, optional = false }: { value: StudentDestination; onChange: (value: StudentDestination) => void; optional?: boolean }) {
  const id = useId();
  const [data, setData] = useState<StudentCreationDestinations | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getStudentCreationDestinations().then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Could not load student destinations."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!data || value.batch_id || value.programme_id) return;
    if (data.requires_batch && data.batches.length === 1) onChange({ batch_id: data.batches[0].id, programme_id: data.batches[0].programme_id });
    else if (!data.requires_batch && data.programmes.length === 1) onChange({ programme_id: data.programmes[0].id });
  }, [data, value.batch_id, value.programme_id, onChange]);
  if (error) return <p role="alert" style={{ color: "#c53030", fontSize: 13 }}>{error}</p>;
  if (!data) return <p style={{ fontSize: 13 }}>Loading student destinations…</p>;
  const chooseBatch = (batchId: string) => {
    const batch = data.batches.find(row => row.id === batchId);
    onChange(batch ? { batch_id: batch.id, programme_id: batch.programme_id } : { programme_id: value.programme_id });
  };
  return <div style={{ display: "grid", gap: 8, padding: 12, background: "rgba(3,72,82,0.03)", borderRadius: 10 }}>
    {!data.requires_batch && <label htmlFor={`${id}-programme`} style={{ display: "grid", gap: 6, fontSize: 13 }}>
      Programme
      <select id={`${id}-programme`} value={value.programme_id ?? ""} required={!optional} onChange={event => onChange({ programme_id: event.target.value || undefined })} style={{ padding: 10, borderRadius: 8 }}>
        <option value="">Choose a programme</option>
        {data.programmes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
    </label>}
    <label htmlFor={`${id}-batch`} style={{ display: "grid", gap: 6, fontSize: 13 }}>
      Initial batch
      <select id={`${id}-batch`} value={value.batch_id ?? ""} required={data.requires_batch && !optional} onChange={event => chooseBatch(event.target.value)} style={{ padding: 10, borderRadius: 8 }}>
        <option value="">{data.requires_batch ? "Choose an assigned batch" : "No initial batch"}</option>
        {data.batches.filter(row => data.requires_batch || !value.programme_id || row.programme_id === value.programme_id).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
    </label>
    <p style={{ margin: 0, fontSize: 12, color: "rgba(3,72,82,0.65)" }}>{data.requires_batch ? "The student joins this programme and batch with your batch responsibility. Existing batch courses and bundles are included." : "Choose the programme that will own the student record. An initial batch also includes its courses and bundles."}</p>
    {data.requires_batch && !data.batches.length && <p role="alert" style={{ margin: 0, fontSize: 12 }}>No assigned batch is available for student creation. You need batch enrolment permission and an active assigned batch.</p>}
  </div>;
}
