'use client';

import { useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permission';
import { PERM } from '@/lib/permissions';
import { getDuplicateSources, type DuplicateKind } from '@/lib/duplicate-material';
import { BackLink } from './back-link';
import { useCurrentUrl } from '@/lib/useCurrentUrl';
import { withFrom } from '@/lib/nav';
import { cardStyle, inputStyle, noticeStyle, errorStyle, titleStyle } from '@/app/dashboard/programmes/styles';

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
  const noun = kind === 'courses' ? 'course' : 'quiz';
  const items = sources.data?.items ?? [];
  const total = sources.data?.total ?? 0;
  return <div style={{ display: 'grid', gap: 20 }}>
    <BackLink fallback={kind === 'courses' ? '/dashboard/courses' : '/dashboard/test-bank'} style={{ fontSize: 14, fontWeight: 600, color: 'rgba(3,72,82,0.7)', textDecoration: 'none' }} />
    <div>
      <h1 style={{ ...titleStyle, fontSize: 28, margin: 0 }}>Browse {kind} to duplicate</h1>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(3,72,82,0.65)' }}>Pick a {noun} to review it, then make an editable copy in any programme you manage.</p>
    </div>
    {error && <p role='alert' style={errorStyle}>{error.message}</p>}
    <div style={{ position: 'relative' }}>
      <svg aria-hidden width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(3,72,82,0.45)', pointerEvents: 'none' }}>
        <circle cx='11' cy='11' r='7' /><path d='m20 20-3.5-3.5' />
      </svg>
      {/* 16px stops iOS Safari from zooming the page when the field is focused. */}
      <input aria-label='Search material' placeholder={`Search ${kind} by title…`} style={{ ...inputStyle, padding: '12px 14px 12px 40px', fontSize: 16, background: '#fff', border: '1.5px solid rgba(3,72,82,0.15)' }} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
    </div>
    {sources.isPending ? <div style={{ display: 'grid', gap: 10 }} aria-busy='true' aria-label='Loading material'>
      {[0, 1, 2, 3].map(i => <div key={i} style={{ ...rowStyle, height: 72, opacity: 0.5 }} />)}
    </div> : items.length === 0 ? <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center', color: 'rgba(3,72,82,0.65)', fontSize: 14 }}>
      {search ? <>No {kind} match <strong>“{search}”</strong>.</> : <>No {kind} available to duplicate yet.</>}
    </div> : <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'rgba(3,72,82,0.6)' }}>{total} {total === 1 ? noun : kind}</p>
        {(page > 1 || sources.data?.has_next) && <nav aria-label='Pagination' style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(3,72,82,0.7)', marginRight: 4 }}>Page {page}</span>
          <button type='button' aria-label='Previous' style={pagerBtn(page > 1)} disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
          <button type='button' aria-label='Next' style={pagerBtn(!!sources.data?.has_next)} disabled={!sources.data?.has_next} onClick={() => setPage(page + 1)}>›</button>
        </nav>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(source => <Link key={source.id} className='og-dup-row' style={rowStyle} aria-label={`Open ${source.title}`} href={withFrom(detailHref(source.id), currentUrl)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#034852', lineHeight: 1.35 }}>{source.title}</div>
            {source.description && <div style={{ marginTop: 2, fontSize: 13, color: 'rgba(3,72,82,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.description}</div>}
            <span style={pillStyle}>{source.owner_programme_name ?? 'Global'}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#209379', whiteSpace: 'nowrap' }}>Review {noun} →</span>
        </Link>)}
      </div>
    </>}
    <style>{`.og-dup-row:hover { border-color: rgba(32,147,121,0.45) !important; box-shadow: 0 4px 14px rgba(3,72,82,0.08) !important; }`}</style>
  </div>;
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', textDecoration: 'none',
  background: '#fff', borderRadius: 16, border: '1.5px solid rgba(3,72,82,0.08)', boxShadow: '0 2px 8px rgba(3,72,82,0.05)',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const pillStyle: React.CSSProperties = {
  display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.04em', textTransform: 'uppercase', background: 'rgba(3,72,82,0.07)', color: '#034852',
};
function pagerBtn(enabled: boolean): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 999, fontSize: 18, lineHeight: 1,
    border: '1px solid rgba(3,72,82,0.15)', background: '#fff', color: '#034852',
    cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.4,
  };
}
