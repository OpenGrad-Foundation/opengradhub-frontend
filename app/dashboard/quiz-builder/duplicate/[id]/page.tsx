"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/back-link";
import { DuplicateAction } from "@/components/duplicate-action";
import { QuizMaterialView } from "@/components/quiz-material-view";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getDuplicatePreview } from "@/lib/duplicate-material";
import type { Quiz } from "@/lib/api";

/**
 * Review a quiz before copying it.
 *
 * The material endpoint returns the quiz in the same shape `getQuizById` gives,
 * so the read-only quiz view renders it directly — no reshaping, and nothing
 * fetched that the browser did not already fetch.
 */
export default function DuplicateQuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { has, isLoading: permLoading } = usePermissions();
  const allowed = has(PERM.test_bank.create);

  const preview = useQuery({
    queryKey: ["og", "duplicate", "quizzes", "preview", id],
    queryFn: () => getDuplicatePreview("quizzes", id),
    enabled: allowed,
  });

  if (permLoading) return null;
  if (!allowed) return <p style={notice}>Browsing duplication material requires the quiz create permission.</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <BackLink fallback="/dashboard/test-bank/duplicate">← Browse quizzes to duplicate</BackLink>
      {preview.isPending && <p>Loading quiz…</p>}
      {preview.error && <p role="alert" style={{ ...notice, color: "#e53e3e" }}>{preview.error.message}</p>}
      {preview.data && (
        <>
          <QuizMaterialView quiz={preview.data as unknown as Quiz} />
          <div style={cardStyle}>
            <DuplicateAction kind="quizzes" sourceId={id} ready={!!preview.data} />
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "rgba(3,72,82,0.55)" }}>
              Copies share question-bank questions; editing a shared question changes every use. Learner records are never copied.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const notice: React.CSSProperties = { fontSize: 14, color: "rgba(3,72,82,0.7)" };
const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px",
  padding: "20px 24px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
};
