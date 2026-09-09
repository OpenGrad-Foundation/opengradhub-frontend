'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permission';
import { PERM } from '@/lib/permissions';
import { duplicateCourse, duplicateQuiz } from '@/lib/api';
import { getDuplicateDestinations, type DuplicateKind } from '@/lib/duplicate-material';
import { useInvalidate } from '@/lib/mutations/invalidation';
import { useCurrentUrl } from '@/lib/useCurrentUrl';
import { withFrom } from '@/lib/nav';
import { errorStyle, inputStyle, primaryButton, secondaryButton } from '@/app/dashboard/programmes/styles';

const GLOBAL_DESTINATION = '__global__';

/**
 * Choose a destination programme and take the copy.
 *
 * One component because there are now two places to do it — the duplication
 * browser and the course material view — and a second copy of the destination
 * rules is a second chance for them to disagree about what is permitted.
 */
export function DuplicateAction({ kind, sourceId, ready = true }: {
  kind: DuplicateKind;
  sourceId: string;
  /** False while the material is still loading or failed: nothing to copy yet. */
  ready?: boolean;
}) {
  const { has } = usePermissions();
  const invalidate = useInvalidate();
  const currentUrl = useCurrentUrl();
  const [selection, setSelection] = useState('');

  const destinations = useQuery({
    queryKey: ['og', 'duplicate', kind, 'destinations'],
    queryFn: () => getDuplicateDestinations(kind),
  });

  const options = [
    ...(destinations.data?.programmes ?? []).map(programme => ({ value: programme.id, label: programme.name })),
    ...(destinations.data?.can_global ? [{ value: GLOBAL_DESTINATION, label: 'Global' }] : []),
  ];
  const destination = options.length === 1 ? options[0].value : selection;
  const selectedIsValid = options.some(option => option.value === destination);

  const copy = useMutation({
    mutationFn: async (): Promise<{ id: string; title: string }> => {
      if (!sourceId || !selectedIsValid) throw new Error('Choose a permitted destination programme.');
      const programmeId = destination === GLOBAL_DESTINATION ? null : destination;
      return kind === 'courses' ? duplicateCourse(sourceId, programmeId) : duplicateQuiz(sourceId, programmeId);
    },
    onSuccess: () => invalidate(kind === 'courses' ? 'courses' : 'quizzes', 'programmes'),
  });

  const canOpenCopy = kind === 'courses' ? has(PERM.courses.edit) : has(PERM.test_bank.view);
  const error = destinations.error ?? copy.error;

  if (destinations.isPending) return <p>Loading destinations…</p>;
  if (options.length === 0) return <p>No permitted destination programmes are available.</p>;

  return <div style={{ display: 'grid', gap: 10 }}>
    {error && <p role='alert' style={errorStyle}>{error.message}</p>}
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      {/* The select is drawn even for a single destination: a bare label read as
          "there is nothing to pick here" when in fact the copy was about to be
          taken into that programme. One option is preselected, not hidden. */}
      <label>Destination programme <select aria-label='Destination programme' style={inputStyle} value={destination} onChange={event => setSelection(event.target.value)}>
        {options.length > 1 && <option value=''>Choose programme</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <button
        style={primaryButton}
        disabled={!selectedIsValid || !ready || copy.isPending || copy.isSuccess}
        onClick={() => copy.mutate()}
      >
        {copy.isPending ? 'Creating…' : 'Create copy'}
      </button>
    </div>
    {copy.data && <p role='status' style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      Created “{copy.data.title}”.
      {canOpenCopy && <Link
        style={{ ...secondaryButton, textDecoration: 'none', display: 'inline-block' }}
        href={withFrom(kind === 'courses' ? `/dashboard/course-management/${copy.data.id}` : `/dashboard/quiz-builder/${copy.data.id}`, currentUrl)}
      >Open copy</Link>}
    </p>}
  </div>;
}
