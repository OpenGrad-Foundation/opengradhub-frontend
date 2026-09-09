import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { BatchImpactNotice, mergeBatchImpacts } from '../components/programme-batch-impact';
afterEach(cleanup);
it('deduplicates repeated items while retaining identical IDs of different content kinds', () => {
  const course = { course_id: 'shared', title: 'Course one', owner_programme: 'Elsewhere' };
  const assignment = { id: 'shared', course_id: 'shared', kind: 'assignments' as const, title: 'Assignment one', owner_programme: 'Elsewhere' };
  const items = mergeBatchImpacts([[course, assignment], [course]]);
  expect(items).toHaveLength(2);
  render(<BatchImpactNotice items={items} />);
  expect(screen.getByText(/2 content items/)).toBeTruthy();
  expect(screen.getByText(/Assignment: Assignment one/)).toBeTruthy();
});
it('describes an empty edit-access impact without claiming there are no other effects', () => {
  render(<BatchImpactNotice items={[]} />);
  expect(screen.getByText('No programme content loses edit access.')).toBeTruthy();
});
