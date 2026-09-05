import { API_BASE_URL, apiFetch, ApiError, type Course, type ModuleWithProgress } from './api';

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

/** The course preview, in the shape the ordinary read-only course view renders. */
export type CourseViewMaterial = {
  course: Course;
  modules: ModuleWithProgress[];
  /** Quiz id → its full question tree, so a quiz row opens without another request. */
  quizMaterial: Record<string, MaterialNode>;
};

/**
 * Reshape a course duplicate-preview into the course view's own view model.
 *
 * The preview endpoint already returns everything the course page draws — the
 * course record, modules, lessons with their notes and video, and every quiz
 * question with its answer key. Rendering it through the normal course view
 * instead of a flat field dump means a reviewer walks the course the way any
 * view-only staff member does, and it needs no extra request and no widening
 * of the curriculum read gate: nothing here is fetched that was not already.
 *
 * Progress is absent by construction. This is material, not anyone's course, so
 * every completion flag is false and nothing is ever locked.
 */
export function materialToCourseView(node: MaterialNode): CourseViewMaterial {
  const source = (node.course ?? {}) as Record<string, unknown>;
  const course = {
    id: String(source.id ?? ''),
    title: String(source.title ?? 'Untitled course'),
    description: (source.description as string | null) ?? null,
    programme_type: String(source.programme_type ?? ''),
    cover_image_url: (source.cover_image_url as string | null) ?? null,
    locking_mode: String(source.locking_mode ?? 'OPEN'),
    access_type: String(source.access_type ?? 'FREE'),
    status: String(source.status ?? 'ACTIVE'),
    tags: (source.tags as string[] | undefined) ?? [],
    created_by: String(source.created_by ?? ''),
    created_at: String(source.created_at ?? ''),
    lesson_count: Number(source.lesson_count ?? 0),
    quiz_count: Number(source.quiz_count ?? 0),
  } as Course;

  const quizMaterial: Record<string, MaterialNode> = {};
  const modules = (node.modules ?? []).map((module, moduleIndex) => {
    const moduleId = String(module.id ?? moduleIndex);
    for (const quiz of module.quizzes ?? []) {
      if (quiz.id) quizMaterial[String(quiz.id)] = quiz;
    }
    return {
      id: moduleId,
      course_id: course.id,
      title: String(module.title ?? ''),
      order_index: Number(module.order_index ?? moduleIndex),
      is_module_complete: false,
      is_locked: false,
      lessons: (module.lessons ?? []).map((lesson, lessonIndex) => ({
        id: String(lesson.id ?? lessonIndex),
        module_id: moduleId,
        title: String(lesson.title ?? ''),
        youtube_url: (lesson.youtube_url as string | null) ?? '',
        duration_minutes: (lesson.duration_minutes as number | null) ?? null,
        notes_html: (lesson.notes_html as string | null) ?? null,
        order_index: Number(lesson.order_index ?? lessonIndex),
        is_complete: false,
      })),
      // `published` is not part of the material payload and is not consulted in
      // this variant: an unpublished module quiz is copied with the course, so
      // hiding it here would understate what the copy contains.
      module_quizzes: (module.quizzes ?? []).map((quiz, quizIndex) => ({
        id: String(quiz.id ?? quizIndex),
        title: String(quiz.title ?? ''),
        published: true,
        order_index: Number(quiz.order_index ?? quizIndex),
        is_complete: false,
      })),
    } satisfies ModuleWithProgress;
  });

  return { course, modules, quizMaterial };
}
