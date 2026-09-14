import { API_BASE_URL, ApiError, apiFetch } from './api';
import type { StudentImportRequest, StudentImportRow, StudentImportResult } from './student-details-import';

async function send<T>(action: 'preview' | 'commit', body: unknown): Promise<T> {
  const response = await apiFetch(`${API_BASE_URL}/tracker/student-details-import/${action}`, {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(Array.isArray(error?.message) ? error.message.join('; ') : error?.message ?? 'Student import failed.', response.status);
  }
  return response.json() as Promise<T>;
}
export function previewStudentImport(body: StudentImportRequest) {
  return send<{ rows: StudentImportRow[] }>('preview', body);
}
export function commitStudentImport(body: StudentImportRequest & { selected: { row_number: number; student_id: string }[] }) {
  return send<StudentImportResult>('commit', body);
}
