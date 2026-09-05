'use client';

import { MathContent } from '@/app/dashboard/_components/MathContent';
import type { MaterialNode } from '@/lib/duplicate-material';

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

/**
 * Render the material fields and answer keys; this subtree has no authoring actions.
 *
 * Lives in its own file because two surfaces draw it: the duplication browser
 * (for quizzes, which have no richer view to fall back on) and the course view's
 * material variant (for one quiz at a time, opened from its row).
 */
export function MaterialPreview({ node }: { node: MaterialNode }) {
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
