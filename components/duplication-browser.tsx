'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permission';
import { PERM } from '@/lib/permissions';
import { getDuplicateSources, type DuplicateKind } from '@/lib/duplicate-material';
import { BackLink } from './back-link';
import { useCurrentUrl } from '@/lib/useCurrentUrl';
import { withFrom } from '@/lib/nav';
import { cardStyle, inputStyle, noticeStyle, errorStyle, secondaryButton, titleStyle } from '@/app/dashboard/programmes/styles';

export function DuplicationBrowser({ kind }: { kind: DuplicateKind }) {
  const { has } = usePermissions();
  const allowed = has(kind === 'courses' ? PERM.courses.create : PERM.test_bank.create);
  const currentUrl = useCurrentUrl();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sources = useQuery({ queryKey: ['og', 'duplicate', kind, 'sources', search, page], queryFn: () => getDuplicateSources(kind, search, page), enabled: allowed });

  if (!allowed) return <p style={noticeStyle}>Browsing duplication material requires the {kind === 'courses' ? 'course' : 'quiz'} create permission.</p>;

  // Both kinds now have a read-only view of their own, so reviewing means
  // opening the material and reading it in its own shape. This screen finds it.
  const detailHref = (id: string) => kind === 'courses'
    ? `/dashboard/courses/${id}?mode=duplicate`
    : `/dashboard/quiz-builder/duplicate/${id}`;
  const error = sources.error;
  return <div style={{ display: 'grid', gap: 20 }}>
    <BackLink fallback={kind === 'courses' ? '/dashboard/courses' : '/dashboard/test-bank'} />
    <h1 style={titleStyle}>Browse {kind} to duplicate</h1>
    {error && <p role='alert' style={errorStyle}>{error.message}</p>}
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Search material <input aria-label='Search material' style={{ ...inputStyle, maxWidth: 400 }} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
    <div style={{ ...cardStyle, padding: 16 }}>
      {sources.isPending ? <p>Loading material…</p> : <>
        {sources.data?.items.map(source => <div key={source.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(3,72,82,0.08)' }}>
          <div><strong>{source.title}</strong>{source.owner_programme_name && <div>{source.owner_programme_name}</div>}</div>
          <Link style={{ ...secondaryButton, textDecoration: 'none', display: 'inline-block' }} aria-label={`Open ${source.title}`} href={withFrom(detailHref(source.id), currentUrl)}>Open {kind === 'courses' ? 'course' : 'quiz'}</Link>
        </div>)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button style={secondaryButton} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page}</span>
          <button style={secondaryButton} disabled={!sources.data?.has_next} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </>}
    </div>
  </div>;
}
