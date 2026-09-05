'use client';
import { Suspense } from 'react';
import { DuplicationBrowser } from '@/components/duplication-browser';
export default function CourseDuplicatePage() {
  return <Suspense fallback={<p>Loading…</p>}><DuplicationBrowser kind='courses' /></Suspense>;
}
