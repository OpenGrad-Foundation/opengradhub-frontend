"use client";

/**
 * Printable register sheet — pre-filled roster, blank date columns whose
 * headers the teacher fills in. Layout is deliberately plain and high-contrast
 * so the VLM extraction reads it reliably.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSheetData } from "@/lib/queries/attendance";

const DATE_COLUMNS = 8;

function SheetInner() {
  const params = useSearchParams();
  const schoolId = params.get("school_id");
  const month = params.get("month");
  const { data, isLoading, error } = useSheetData(schoolId, month);

  if (!schoolId || !month) return <p className="p-6 text-slate-600">Missing school or month.</p>;
  if (isLoading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (error || !data) return <p className="p-6 text-red-600">Could not load sheet data.</p>;

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 print:p-0">
      <div className="flex items-start justify-between print:hidden">
        <p className="text-sm text-slate-500">
          Print this sheet and hand it to the school. Teacher writes the date (DD/MM) in each
          column header and marks <b>P</b> (present) or <b>A</b> (absent) per student.
        </p>
        <button
          onClick={() => window.print()}
          className="ml-4 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]"
        >
          Print
        </button>
      </div>

      <div className="mt-4 border-2 border-black">
        <div className="border-b-2 border-black p-3">
          <h1 className="text-lg font-bold">OpenGrad Attendance Register</h1>
          <div className="mt-1 flex flex-wrap gap-x-8 text-sm">
            <span>School: <b>{data.school_name}</b></span>
            <span>Month: <b>{data.month}</b></span>
          </div>
          <p className="mt-1 text-xs">
            Mark P = present, A = absent. One column per class day; write the date as DD/MM in
            the header row. Do not change printed names or codes.
          </p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1.5 text-left w-14">Code</th>
              <th className="border border-black px-2 py-1.5 text-left">Student name</th>
              {Array.from({ length: DATE_COLUMNS }, (_, i) => (
                <th key={i} className="border border-black px-1 py-1.5 w-14">
                  <span className="block text-[10px] font-normal text-slate-500">Date:</span>
                  <span className="block h-4" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.short_code}>
                <td className="border border-black px-2 py-2 font-mono font-bold">{s.short_code}</td>
                <td className="border border-black px-2 py-2">{s.name}</td>
                {Array.from({ length: DATE_COLUMNS }, (_, i) => (
                  <td key={i} className="border border-black px-1 py-2" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SheetPage() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Loading…</p>}>
      <SheetInner />
    </Suspense>
  );
}
