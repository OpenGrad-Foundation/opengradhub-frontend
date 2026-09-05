'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permission';
import { PERM } from '@/lib/permissions';
import { getDuplicatePreview, getDuplicateSources, type DuplicateKind } from '@/lib/duplicate-material';
import { BackLink } from './back-link';
import { DuplicateAction } from './duplicate-action';
import { MaterialPreview } from './material-preview';
import { useCurrentUrl } from '@/lib/useCurrentUrl';
import { withFrom } from '@/lib/nav';
import { cardStyle, inputStyle, noticeStyle, errorStyle, secondaryButton, titleStyle } from '@/app/dashboard/programmes/styles';

export function DuplicationBrowser({ kind, initialSourceId }: { kind: DuplicateKind; initialSourceId?: string }) {
  const { has } = usePermissions();
  const allowed = has(kind === 'courses' ? PERM.courses.create : PERM.test_bank.create);
  const params = useSearchParams();
  const currentUrl = useCurrentUrl();
  const [sourceId, setSourceId] = useState(initialSourceId ?? params.get('source') ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sources = useQuery({ queryKey: ['og', 'duplicate', kind, 'sources', search, page], queryFn: () => getDuplicateSources(kind, search, page), enabled: allowed });
  const preview = useQuery({ queryKey: ['og', 'duplicate', kind, 'preview', sourceId], queryFn: () => getDuplicatePreview(kind, sourceId), enabled: allowed && !!sourceId });

  if (!allowed) return <p style={noticeStyle}>Browsing duplication material requires the {kind === 'courses' ? 'course' : 'quiz'} create permission.</p>;

  // A course has a view of its own, so reviewing one means opening it and
  // walking the curriculum. A quiz has no such view and is previewed in place.
  const opensInCourseView = kind === 'courses';
  const error = sources.error ?? preview.error;
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
          {opensInCourseView
            ? <Link style={{ ...secondaryButton, textDecoration: 'none', display: 'inline-block' }} aria-label={`Open ${source.title}`} href={withFrom(`/dashboard/courses/${source.id}?mode=duplicate`, currentUrl)}>Open course</Link>
            : <button style={secondaryButton} aria-label={`Preview ${source.title}`} onClick={() => setSourceId(source.id)}>Preview</button>}
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
      <div style={{ marginTop: 20 }}>
        <DuplicateAction kind={kind} sourceId={sourceId} ready={!!preview.data && !preview.error} />
      </div>
    </section>}
  </div>;
}
