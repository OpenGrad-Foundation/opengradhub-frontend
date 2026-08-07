"use client";

/**
 * Printable register sheet — pre-filled roster, blank month, blank date columns.
 *
 * The month is handwritten by the school just like the day numbers: nothing on
 * the sheet commits it to a period in advance, and both are read back off the
 * paper at upload time. Layout is deliberately plain and high-contrast so the
 * VLM extraction reads it reliably.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSheetData } from "@/lib/queries/attendance";

const DATE_COLUMNS = 8;

function SheetInner() {
  const params = useSearchParams();
  const schoolId = params.get("school_id");
  // Still honoured when present so previously printed links keep working.
  const month = params.get("month");
  const { data, isLoading, error } = useSheetData(schoolId, month);

  if (!schoolId) return <p className="p-6 text-slate-600">Missing school.</p>;
  if (isLoading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (error || !data) return <p className="p-6 text-red-600">Could not load sheet data.</p>;

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 print:p-0">
      <div className="flex items-start justify-between print:hidden">
        <p className="text-sm text-slate-500">
          Print this sheet and hand it to the school. Teacher writes the <b>month and year</b> in
          the header, the <b>day</b> in each column header, and marks <b>P</b> (present) or{" "}
          <b>A</b> (absent) per student.
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
          <div className="mt-1 flex flex-wrap items-end gap-x-8 gap-y-1 text-sm">
            <span>School: <b>{data.school_name}</b></span>
            {data.month ? (
              <span>Month &amp; Year: <b>{data.month}</b></span>
            ) : (
              // Blank by design — the school writes it, the model reads it back.
              <span className="flex items-end gap-1">
                Month &amp; Year:
                <span className="inline-block w-44 border-b border-black" />
              </span>
            )}
          </div>
          <p className="mt-1 text-xs">
            Mark P = present, A = absent. Write the month and year above (e.g. July 2026). One
            column per class day; write the day number in the header row. Do not change printed
            names or codes.
          </p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1.5 text-left w-14">Code</th>
              <th className="border border-black px-2 py-1.5 text-left">Student name</th>
              {Array.from({ length: DATE_COLUMNS }, (_, i) => (
                <th key={i} className="border border-black px-1 py-1.5 w-14">
                  <span className="block text-[10px] font-normal text-slate-500">Day:</span>
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
