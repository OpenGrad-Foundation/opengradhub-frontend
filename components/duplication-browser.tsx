'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permission';
import { PERM } from '@/lib/permissions';
import { duplicateCourse, duplicateQuiz } from '@/lib/api';
import { getDuplicateDestinations, getDuplicatePreview, getDuplicateSources, type DuplicateKind, type MaterialNode } from '@/lib/duplicate-material';
import { useInvalidate } from '@/lib/mutations/invalidation';
import { BackLink } from './back-link';
import { useCurrentUrl } from '@/lib/useCurrentUrl';
import { withFrom } from '@/lib/nav';
import { MathContent } from '@/app/dashboard/_components/MathContent';
import { cardStyle, inputStyle, noticeStyle, errorStyle, primaryButton, secondaryButton, titleStyle } from '@/app/dashboard/programmes/styles';

const GLOBAL_DESTINATION = '__global__';

export function DuplicationBrowser({ kind, initialSourceId }: { kind: DuplicateKind; initialSourceId?: string }) {
  const { has } = usePermissions();
  const allowed = has(kind === 'courses' ? PERM.courses.create : PERM.test_bank.create);
  const params = useSearchParams();
  const currentUrl = useCurrentUrl();
  const [sourceId, setSourceId] = useState(initialSourceId ?? params.get('source') ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState('');
  const invalidate = useInvalidate();
  const sources = useQuery({ queryKey: ['og', 'duplicate', kind, 'sources', search, page], queryFn: () => getDuplicateSources(kind, search, page), enabled: allowed });
  const destinations = useQuery({ queryKey: ['og', 'duplicate', kind, 'destinations'], queryFn: () => getDuplicateDestinations(kind), enabled: allowed });
  const preview = useQuery({ queryKey: ['og', 'duplicate', kind, 'preview', sourceId], queryFn: () => getDuplicatePreview(kind, sourceId), enabled: allowed && !!sourceId });
  const options = [
    ...(destinations.data?.programmes ?? []).map(programme => ({ value: programme.id, label: programme.name })),
    ...(destinations.data?.can_global ? [{ value: GLOBAL_DESTINATION, label: 'Global' }] : []),
  ];
  const destination = options.length === 1 ? options[0].value : selection;
  const selectedIsValid = options.some(option => option.value === destination);
  const copy = useMutation({
    mutationFn: async (): Promise<{ id: string; title: string }> => {
      if (!allowed || !sourceId || !selectedIsValid) throw new Error('Choose a permitted destination programme.');
      const programmeId = destination === GLOBAL_DESTINATION ? null : destination;
      return kind === 'courses' ? duplicateCourse(sourceId, programmeId) : duplicateQuiz(sourceId, programmeId);
    },
    onSuccess: () => invalidate(kind === 'courses' ? 'courses' : 'quizzes', 'programmes'),
  });

  if (!allowed) return <p style={noticeStyle}>Browsing duplication material requires the {kind === 'courses' ? 'course' : 'quiz'} create permission.</p>;

  const error = sources.error ?? destinations.error ?? preview.error ?? copy.error;
  const canOpenCopy = kind === 'courses' ? has(PERM.courses.edit) : has(PERM.test_bank.view);
  return <div style={{ display: 'grid', gap: 20 }}>
    <BackLink fallback={kind === 'courses' ? '/dashboard/courses' : '/dashboard/test-bank'} />
    <h1 style={titleStyle}>Browse {kind} to duplicate</h1>
    <p style={noticeStyle}>Preview material from all programmes, then create a draft in your destination programme. Copies share question-bank questions; editing a shared question changes every use. Learner records are never copied.</p>
    {error && <p role='alert' style={errorStyle}>{error.message}</p>}
    <label>Search material <input aria-label='Search material' style={{ ...inputStyle, maxWidth: 400, marginLeft: 8 }} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    <div style={{ ...cardStyle, padding: 16 }}>
      {sources.isPending ? <p>Loading material…</p> : <>
        <p>{sources.data?.total ?? 0} matching {kind}</p>
        {sources.data?.items.map(source => <div key={source.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(3,72,82,0.08)' }}>
          <div><strong>{source.title}</strong>{source.owner_programme_name && <div>{source.owner_programme_name}</div>}</div>
          <button style={secondaryButton} aria-label={`Preview ${source.title}`} onClick={() => { setSourceId(source.id); copy.reset(); }}>Preview</button>
        </div>)}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button style={secondaryButton} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page}</span>
          <button style={secondaryButton} disabled={!sources.data?.has_next} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </>}
    </div>
    {sourceId && <section aria-label='Material preview' style={{ ...cardStyle, padding: 20 }}>
      <h2 style={{ ...titleStyle, fontSize: 20 }}>Material preview</h2>
      {preview.isPending ? <p>Loading preview…</p> : preview.data && <MaterialPreview node={preview.data} />}
      {destinations.isPending ? <p>Loading destinations…</p> : options.length === 0 ? <p>No permitted destination programmes are available.</p> : <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
        {options.length === 1 ? <span>Destination: {options[0].label}</span> : <label>Destination programme <select aria-label='Destination programme' style={inputStyle} value={selection} onChange={event => setSelection(event.target.value)}>
          <option value=''>Choose programme</option>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>}
        <button style={primaryButton} disabled={!selectedIsValid || !preview.data || !!preview.error || copy.isPending || copy.isSuccess} onClick={() => copy.mutate()}>{copy.isPending ? 'Creating…' : 'Create copy'}</button>
      </div>}
      {copy.data && <p role='status'>Created “{copy.data.title}”. {canOpenCopy && <Link href={withFrom(kind === 'courses' ? `/dashboard/course-management/${copy.data.id}` : `/dashboard/quiz-builder/${copy.data.id}`, currentUrl)}>Open copy</Link>}</p>}
    </section>}
  </div>;
}

const MATERIAL_SETTINGS: Record<string, string> = {
  question_type: 'Question type', subject: 'Subject', topic: 'Topic', difficulty: 'Difficulty',
  marks: 'Marks', negative_marks: 'Negative marks', tolerance: 'Tolerance', answer_time_minutes: 'Answer time (minutes)',
  duration_minutes: 'Duration (minutes)', max_attempts: 'Maximum attempts', pass_threshold_percent: 'Pass threshold (%)',
  quiz_type: 'Quiz type', shuffle_questions: 'Shuffle questions', show_answers_after: 'Show answers after submission',
  sequential_sections: 'Sequential sections', first_attempt_counts: 'First attempt counts', require_fullscreen: 'Fullscreen required',
  negative_marking: 'Negative marking', correct_marks: 'Correct answer marks', wrong_marks: 'Wrong answer marks',
};
const CHILDREN = ['modules', 'lessons', 'quizzes', 'sections', 'questions', 'children'] as const;
function safeMediaUrl(value: string): boolean { return /^https?:\/\//i.test(value); }

/** Render the material fields and answer keys; this subtree has no authoring actions. */
function MaterialPreview({ node }: { node: MaterialNode }) {
  return <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
    {node.course && <MaterialPreview node={node.course} />}
    {(node.title || node.name) && <h3 style={{ fontWeight: 700 }}>{node.title ?? node.name}</h3>}
    {node.description && <MathContent html={node.description} />}
    {[node.instruction_html, node.content_html, node.notes_html].filter((html): html is string => typeof html === 'string' && !!html).map((html, index) => <MathContent key={index} html={html} />)}
    {node.image_url && safeMediaUrl(node.image_url) && <img src={node.image_url} alt='Question illustration' style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }} />}
    {node.options?.map((option, index) => <div key={option.id ?? index} style={{ paddingLeft: 12 }}><MathContent html={option.option_text ?? ''} />{option.is_correct && <strong>Correct option</strong>}</div>)}
    {node.correct_answer != null && <div><strong>Answer: </strong><MathContent html={String(node.correct_answer)} /></div>}
    {node.solution && <div><strong>Solution</strong><MathContent html={node.solution} /></div>}
    {[node.youtube_url, node.explanation_video_url].filter((url): url is string => typeof url === 'string' && safeMediaUrl(url)).map((url, index) => <a key={index} href={url} target='_blank' rel='noopener noreferrer'>Open {index === 0 && node.youtube_url ? 'lesson video' : 'explanation video'}</a>)}
    <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>{Object.entries(MATERIAL_SETTINGS).filter(([key]) => node[key] != null).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{typeof node[key] === 'boolean' ? node[key] ? 'Yes' : 'No' : String(node[key])}</dd></div>)}</dl>
    {CHILDREN.map(key => node[key]?.length ? <div key={key} style={{ borderLeft: '2px solid rgba(3,72,82,0.12)', paddingLeft: 16 }}><h4 style={{ textTransform: 'capitalize', fontWeight: 700 }}>{key === 'children' ? 'Subquestions' : key}</h4>{node[key]!.map((child, index) => <MaterialPreview key={child.id ?? index} node={child} />)}</div> : null)}
  </div>;
}
