"use client";

import { useParams } from "next/navigation";
import { DuplicationBrowser } from "@/components/duplication-browser";

/** Old review URLs now use the same material-only preview and allowed destinations. */
export default function DuplicateQuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <DuplicationBrowser key={id} kind="quizzes" initialSourceId={id} />;
}
