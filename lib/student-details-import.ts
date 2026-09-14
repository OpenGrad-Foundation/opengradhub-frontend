import Papa from 'papaparse';

export const STUDENT_CSV_MAX_BYTES = 2 * 1024 * 1024;
export type StudentCsv = { headers: string[]; rows: { row_number: number; cells: string[] }[] };
export type StudentImportRequest = {
  identifier_type: 'student_id' | 'roll_number'; overwrite: boolean;
  rows: { row_number: number; identifier: string; values: Record<string, string> }[];
};
export type StudentImportRow = {
  row_number: number; identifier: string;
  status: 'ready' | 'invalid' | 'duplicate' | 'unmatched' | 'unchanged' | 'saved';
  student_id?: string; student_name?: string; school_name?: string | null;
  messages: string[];
  changes: { field_key: string; label: string; value: unknown; previous: unknown }[];
};
export type StudentImportResult = { saved: number; saved_cells: number; rows: StudentImportRow[] };

export function parseStudentCsv(text: string): StudentCsv {
  if (new TextEncoder().encode(text).length > STUDENT_CSV_MAX_BYTES) throw new Error('Choose a CSV smaller than 2 MB.');
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { dynamicTyping: false, skipEmptyLines: false });
  if (parsed.errors.some(e => e.code !== 'UndetectableDelimiter')) throw new Error('The CSV contains malformed quotes or delimiters. Check the file and upload it again.');
  const [rawHeaders = [], ...data] = parsed.data;
  const headers = rawHeaders.map(h => h.trim());
  if (headers.length < 2 || headers.length > 100 || headers.some(h => !h || h.length > 200)) throw new Error('Use 2–100 named columns, including a student identifier.');
  if (new Set(headers.map(h => h.toLowerCase())).size !== headers.length) throw new Error('Each CSV column must have a unique header.');
  const rows = data.flatMap((cells, index) => {
    if (cells.every(v => !v.trim())) return [];
    if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${cells.length} cells; expected ${headers.length}.`);
    if (cells.some(v => v.length > 10000)) throw new Error(`CSV row ${index + 2} contains a cell longer than 10,000 characters.`);
    return [{ row_number: index + 2, cells }];
  });
  if (!rows.length || rows.length > 1000) throw new Error('Upload between 1 and 1,000 non-empty student rows.');
  return { headers, rows };
}

export function buildStudentImport(csv: StudentCsv, mapping: Record<string, string>, identifierColumn: number,
  identifierType: StudentImportRequest['identifier_type'], overwrite: boolean): StudentImportRequest {
  const mapped = Object.entries(mapping).filter(([, key]) => !!key);
  if (!mapped.length || mapped.length > 50) throw new Error('Map between 1 and 50 columns to student fields.');
  if (new Set(mapped.map(([, key]) => key)).size !== mapped.length) throw new Error('Map each student field only once.');
  if (!Number.isInteger(identifierColumn) || identifierColumn < 0 || identifierColumn >= csv.headers.length) throw new Error('Choose the column that identifies each student.');
  if (mapped.some(([index]) => !Number.isInteger(Number(index)) || Number(index) < 0 || Number(index) >= csv.headers.length)) throw new Error('Choose valid CSV columns.');
  const request: StudentImportRequest = {
    identifier_type: identifierType, overwrite,
    rows: csv.rows.map(row => ({ row_number: row.row_number, identifier: row.cells[identifierColumn],
      values: Object.fromEntries(mapped.map(([index, key]) => [key, row.cells[Number(index)]])) })),
  };
  // Leave room for the selection sent at commit within the server's 2 MB ceiling.
  if (new TextEncoder().encode(JSON.stringify(request)).length + csv.rows.length * 100 > STUDENT_CSV_MAX_BYTES)
    throw new Error('The mapped upload is too large. Split it into smaller CSV files.');
  return request;
}

export function readStudentCsv(file: File): Promise<StudentCsv> {
  if (!/\.csv$/i.test(file.name)) return Promise.reject(new Error('Choose a .csv file.'));
  if (file.size > STUDENT_CSV_MAX_BYTES) return Promise.reject(new Error('Choose a CSV smaller than 2 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file. Please try again.'));
    reader.onload = () => { try { resolve(parseStudentCsv(String(reader.result))); } catch (error) { reject(error); } };
    reader.readAsText(file);
  });
}

export function downloadStudentImportReport(rows: StudentImportRow[]) {
  const csv = Papa.unparse(rows.map(row => ({ 'CSV row': row.row_number, Identifier: row.identifier,
    Student: row.student_name ?? '', Status: row.status, Details: row.messages.join('; ') })), { escapeFormulae: true });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'student-details-import-results.csv'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
