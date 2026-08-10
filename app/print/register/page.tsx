"use client";

/**
 * Printable register sheet, template v2 — machine-readable OMR form.
 *
 * Everything geometric comes from the SERVER (descriptor + pre-signed QR
 * content in the sheet-data response): the browser renders the layout but can
 * neither change it nor mint a valid QR, so a printed sheet always matches
 * what the backend extractor expects. Layout is absolute mm positioning —
 * the extractor measures boxes at these exact descriptor coordinates after
 * perspective correction, which is why nothing here may be "responsive".
 *
 * Form language for the school:
 *  - tick ONE box per student per day: [P] present or [A] absent
 *  - one digit per small box in the date headers (DD/MM) and Month & Year
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useSheetData } from "@/lib/queries/attendance";
import type { RegisterDescriptor, SheetPage } from "@/lib/attendance-api";

const mm = (n: number) => `${n}mm`;

const monthLabelText = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" }) + ` ${y}`;
};

/** Same arithmetic as the backend descriptor helpers — constants come from the server. */
function dateColX(d: RegisterDescriptor, col: number): number {
  return d.table.x + d.table.codeW + d.table.nameW + col * d.table.dateColW;
}

/** Mirrors the backend: two day-digit boxes [D][D]. */
function dateCombBoxes(d: RegisterDescriptor, col: number) {
  const c = d.table.comb;
  const rowW = 2 * c.boxW + c.gap;
  const x0 = dateColX(d, col) + (d.table.dateColW - rowW) / 2;
  const y = d.table.y + c.yOffset;
  return [
    { x: x0, y, w: c.boxW, h: c.boxH },
    { x: x0 + c.boxW + c.gap, y, w: c.boxW, h: c.boxH },
  ];
}

function monthCombBoxes(d: RegisterDescriptor) {
  const m = d.header.monthComb;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let x = m.x;
  for (let i = 0; i < 2; i++) { out.push({ x, y: m.y, w: m.boxW, h: m.boxH }); x += m.boxW + m.gap; }
  x += m.yySkip;
  for (let i = 0; i < 2; i++) { out.push({ x, y: m.y, w: m.boxW, h: m.boxH }); x += m.boxW + m.gap; }
  return out;
}

/** One big mark box per cell — tick = present, cross = absent. */
function cellMarkBox(d: RegisterDescriptor, row: number, col: number) {
  const t = d.table;
  return {
    x: dateColX(d, col) + (t.dateColW - t.mark.w) / 2,
    y: t.y + t.headerH + row * t.rowH + (t.rowH - t.mark.h) / 2,
    w: t.mark.w,
    h: t.mark.h,
  };
}

const boxStyle = (b: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({
  position: "absolute",
  left: mm(b.x), top: mm(b.y), width: mm(b.w), height: mm(b.h),
  border: "0.35mm solid #000",
  boxSizing: "border-box",
});

// Column count comes from the server descriptor — no hard-coded mirror.

function Sheet({ d, page, pageCount, schoolName, printedMonth }: {
  d: RegisterDescriptor; page: SheetPage; pageCount: number; schoolName: string;
  printedMonth: string | null;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(page.qr_content, { errorCorrectionLevel: "M", margin: 0 }).then(setQrUrl);
  }, [page.qr_content]);

  const fid = (x: number, y: number, s: number) => (
    <div style={{ position: "absolute", left: mm(x), top: mm(y), width: mm(s), height: mm(s), background: "#000" }} />
  );

  return (
    <div
      className="sheet-page"
      style={{
        position: "relative", width: mm(d.page.w), height: mm(d.page.h),
        background: "#fff", color: "#000", overflow: "hidden",
      }}
    >
      {/* fiducials — TL larger (orientation key), 4mm in from each edge */}
      {fid(4, 4, d.fiducial.tl)}
      {fid(d.page.w - 4 - d.fiducial.other, 4, d.fiducial.other)}
      {fid(d.page.w - 4 - d.fiducial.other, d.page.h - 4 - d.fiducial.other, d.fiducial.other)}
      {fid(4, d.page.h - 4 - d.fiducial.other, d.fiducial.other)}

      {/* crop-prevention hint: short rosters leave the bottom squares in empty
          space and people crop them away — which makes the photo unreadable */}
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: mm(d.page.h - 8),
          textAlign: "center", fontSize: "2.6mm", color: "#555",
        }}
      >
        Photograph the WHOLE page — all 4 black corner squares must be in the picture.
      </div>

      {qrUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrUrl}
          alt=""
          style={{ position: "absolute", left: mm(d.qr.x), top: mm(d.qr.y), width: mm(d.qr.size), height: mm(d.qr.size) }}
        />
      )}

      {/* Header text starts right of the TL fiducial (which spans 4–13mm) —
          at table.x it would sit underneath the black square. */}
      <div style={{ position: "absolute", left: mm(16), top: mm(d.header.titleY - 5), fontSize: "5mm", fontWeight: 700 }}>
        OpenGrad Attendance Register
      </div>
      <div style={{ position: "absolute", left: mm(16), top: mm(d.header.titleY + 3), fontSize: "3.2mm" }}>
        School: <b>{schoolName}</b> — page {page.page}/{pageCount}
      </div>

      {printedMonth ? (
        // Month-specific print: the month is set at print time and signed into
        // the QR — nothing to handwrite, nothing to machine-read.
        <div style={{ position: "absolute", left: mm(d.table.x), top: mm(d.header.monthComb.y + 1.5), fontSize: "3.6mm", fontWeight: 700 }}>
          Month &amp; Year: {monthLabelText(printedMonth)}
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", left: mm(d.table.x), top: mm(d.header.monthComb.y + 1.5), fontSize: "3.2mm" }}>
            Month &amp; Year:
          </div>
          {monthCombBoxes(d).map((b, i) => <div key={i} style={boxStyle(b)} />)}
          <div
            style={{
              position: "absolute",
              left: mm(d.header.monthComb.x + 2 * (d.header.monthComb.boxW + d.header.monthComb.gap) + 1.5),
              top: mm(d.header.monthComb.y + 1.5),
              fontSize: "3.2mm",
            }}
          >
            / 20
          </div>
        </>
      )}
      <div style={{ position: "absolute", left: mm(d.table.x), top: mm(d.header.monthComb.y + 10), fontSize: "2.6mm" }}>
        One big mark per box: ✓ = present, ✗ = absent, leave blank if unknown. Write the day
        (one digit per small box) in each column header{printedMonth ? "" : ", and the month & year above"}.
        Do not change printed names or codes.
      </div>

      {/* table outline + header labels */}
      <div style={boxStyle({ x: d.table.x, y: d.table.y, w: d.table.codeW, h: d.table.headerH })}>
        <span style={{ fontSize: "2.8mm", fontWeight: 700, paddingLeft: "1mm" }}>Code</span>
      </div>
      <div style={boxStyle({ x: d.table.x + d.table.codeW, y: d.table.y, w: d.table.nameW, h: d.table.headerH })}>
        <span style={{ fontSize: "2.8mm", fontWeight: 700, paddingLeft: "1mm" }}>Student name</span>
      </div>
      {Array.from({ length: d.table.dateCols }, (_, c) => (
        <div key={c} style={boxStyle({ x: dateColX(d, c), y: d.table.y, w: d.table.dateColW, h: d.table.headerH })}>
          <span style={{ position: "absolute", left: "0.4mm", top: "0.4mm", fontSize: "1.8mm", color: "#666" }}>Day</span>
        </div>
      ))}
      {Array.from({ length: d.table.dateCols }, (_, c) =>
        dateCombBoxes(d, c).map((b, i) => <div key={`${c}-${i}`} style={boxStyle(b)} />),
      )}

      {/* rows */}
      {page.students.map((s, r) => {
        const y = d.table.y + d.table.headerH + r * d.table.rowH;
        return (
          <div key={s.short_code}>
            <div style={boxStyle({ x: d.table.x, y, w: d.table.codeW, h: d.table.rowH })}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "3mm", paddingLeft: "1mm" }}>
                {s.short_code}
              </span>
            </div>
            <div style={boxStyle({ x: d.table.x + d.table.codeW, y, w: d.table.nameW, h: d.table.rowH })}>
              <span
                style={{
                  display: "block", fontSize: "3mm", lineHeight: mm(d.table.rowH - 1),
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: mm(d.table.nameW - 2), paddingLeft: "1mm",
                }}
              >
                {s.name}
              </span>
            </div>
            {Array.from({ length: d.table.dateCols }, (_, c) => (
              <div key={c}>
                <div style={boxStyle({ x: dateColX(d, c), y, w: d.table.dateColW, h: d.table.rowH })} />
                <div style={boxStyle(cellMarkBox(d, r, c))} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

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
    <div className="mx-auto bg-white p-6 print:p-0" style={{ maxWidth: "230mm" }}>
      <div className="flex items-start justify-between print:hidden">
        <p className="text-sm text-slate-500">
          Print at <b>100% scale on A4</b> and hand to the school. Teacher writes the <b>day</b>
          {data.month ? "" : " and the month & year"} (one digit per box) and marks each student:{" "}
          <b>✓ present</b>, <b>✗ absent</b>, blank if unknown.
        </p>
        <button
          onClick={() => window.print()}
          className="ml-4 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]"
        >
          Print
        </button>
      </div>

      <div className="mt-4 space-y-4 print:mt-0 print:space-y-0">
        {data.pages.map((pg) => (
          <Sheet
            key={pg.page}
            d={data.descriptor}
            page={pg}
            pageCount={data.pages.length}
            schoolName={data.school_name}
            printedMonth={data.month}
          />
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .sheet-page {
            /* A full 297mm element overflows the printable page in most
               engines (rounding), pushing the bottom fiducials onto a second
               page. Clamping the DIV's height is safe: every element inside is
               absolutely positioned from the top, so nothing moves — only the
               page break behaves. */
            height: 296mm !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .sheet-page:last-child { page-break-after: auto; }
        }
      `}</style>
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
