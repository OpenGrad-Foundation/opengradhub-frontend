import { API_BASE_URL, apiFetch, ApiError } from './api';

export type DuplicateKind = 'courses' | 'quizzes';
export type DuplicateSource = { id: string; title: string; description?: string | null; owner_programme_name?: string | null };
export type DuplicateSourcePage = { items: DuplicateSource[]; total: number; has_next: boolean };
export type DuplicateDestinations = { programmes: Array<{ id: string; name: string }>; can_global: boolean };

/** A material tree has no learner, attempt, enrolment or progress records. */
export type MaterialNode = {
  id?: string; title?: string; name?: string; description?: string | null;
  content_html?: string; instruction_html?: string | null; notes_html?: string | null;
  correct_answer?: string | null; solution?: string | null; image_url?: string | null;
  youtube_url?: string | null; explanation_video_url?: string | null;
  option_text?: string; is_correct?: boolean;
  course?: MaterialNode; modules?: MaterialNode[]; lessons?: MaterialNode[];
  quizzes?: MaterialNode[]; sections?: MaterialNode[]; questions?: MaterialNode[];
  options?: MaterialNode[]; children?: MaterialNode[];
  [key: string]: unknown;
};

async function read<T>(path: string): Promise<T> {
  const response = await apiFetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Could not load duplication material.', response.status);
  }
  return response.json();
}

export async function getDuplicateSources(kind: DuplicateKind, search: string, page: number): Promise<DuplicateSourcePage> {
  const size = 30;
  const params = new URLSearchParams({ search, page: String(page), page_size: String(size), all_statuses: 'true' });
  const response = await read<DuplicateSourcePage | DuplicateSource[]>(`/${kind}/duplicate-sources?${params}`);
  if (!Array.isArray(response)) return response;
  // The quiz endpoint returns its complete material catalogue; paginate locally.
  const filtered = response.filter(source => `${source.title} ${source.owner_programme_name ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return { items: filtered.slice((page - 1) * size, page * size), total: filtered.length, has_next: page * size < filtered.length };
}

export function getDuplicateDestinations(kind: DuplicateKind): Promise<DuplicateDestinations> {
  return read(`/${kind}/duplicate-destinations`);
}

export function getDuplicatePreview(kind: DuplicateKind, id: string): Promise<MaterialNode> {
  return read(`/${kind}/${encodeURIComponent(id)}/duplicate-preview`);
}
