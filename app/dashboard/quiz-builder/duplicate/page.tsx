"use client";

import { Suspense } from "react";
import { DuplicationBrowser } from "@/components/duplication-browser";

/** Backwards-compatible entry point for saved quiz duplication links. */
export default function DuplicateQuizBrowsePage() {
  return <Suspense fallback={<p>Loading…</p>}><DuplicationBrowser kind="quizzes" /></Suspense>;
}
