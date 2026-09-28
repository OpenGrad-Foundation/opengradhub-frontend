"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Medal } from "lucide-react";
import { getBackHref } from "@/lib/nav";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getQuizLeaderboard, type QuizLeaderboard } from "@/lib/api";

const page: React.CSSProperties  = { maxWidth: "760px", margin: "0 auto", padding: "32px 16px", color: "var(--color-text)" };
const card: React.CSSProperties  = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)", marginBottom: "20px" };
const label: React.CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 };
const secondaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", cursor: "pointer" };
const primaryBtn: React.CSSProperties = { ...secondaryBtn, border: "1px solid var(--green)", background: "var(--green)", color: "var(--dark-teal)" };

// Gold, silver, bronze.
const MEDAL = ["#b8860b", "#8a9499", "#a0522d"];

export default function LeaderboardPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
  const from = useSearchParams().get("from");
  const { data: userData } = useCurrentUser();

  const [board, setBoard]   = useState<QuizLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    getQuizLeaderboard(quizId)
      .then(setBoard)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load leaderboard."))
      .finally(() => setLoading(false));
  }, [quizId]);

  const myId = userData?.user?.id ?? "";

  if (loading) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Loading leaderboard…</p>
    </div>
  );

  if (error) return (
    <div style={page}>
      <div style={card}>
        <p style={{ color: "#b83232", fontSize: "15px", fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.push(getBackHref(from, `/dashboard/quiz/${quizId}`))} style={{ ...secondaryBtn, marginTop: "16px" }}>Go back</button>
      </div>
    </div>
  );

  if (!board) return null;

  return (
    <div style={page}>
      <button
        onClick={() => router.push(getBackHref(from, `/dashboard/quiz/${quizId}`))}
        style={{ ...secondaryBtn, marginBottom: "20px" }}
      >
        <ArrowLeft size={16} aria-hidden="true" />Back to Quiz
      </button>

      <div style={card}>
        <p style={label}>Leaderboard</p>
        <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text)", margin: "8px 0 0" }}>
          PG Programme Rankings
        </p>
        {board.viewer_rank != null && (
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "6px 0 0" }}>
            Your rank: <strong style={{ color: "var(--color-text)" }}>#{board.viewer_rank}</strong> of {board.rankings.length}
          </p>
        )}
      </div>

      {board.rankings.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "48px" }}>
          <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>No completed attempts yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {board.rankings.map((entry) => {
            const isMe = entry.student_id === myId;
            return (
              <div
                key={entry.student_id}
                style={{
                  display: "flex", alignItems: "center", gap: "16px",
                  padding: "14px 20px", borderRadius: "12px",
                  background: isMe ? "rgba(10,190,98,0.08)" : "var(--color-surface)",
                  border: isMe ? "1px solid var(--green)" : "1px solid var(--color-border)",
                }}
              >
                {/* Rank */}
                <div style={{ width: "36px", textAlign: "center", flexShrink: 0 }}>
                  {entry.rank <= 3
                    ? <span style={{ display: "inline-flex", color: MEDAL[entry.rank - 1] }}><Medal size={22} aria-hidden="true" /><span className="sr-only">#{entry.rank}</span></span>
                    : <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-muted)" }}>#{entry.rank}</span>
                  }
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: isMe ? 800 : 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.name}{isMe && <span style={{ fontSize: "12px", color: "#08784a", marginLeft: "8px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px", background: "rgba(10,190,98,0.1)" }}>You</span>}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {entry.correct_count} correct
                  </p>
                </div>

                {/* Score */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: entry.rank === 1 ? "#08784a" : "var(--color-text)" }}>
                    {entry.score_pct}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => router.push("/dashboard/assessments")}
        style={{ ...secondaryBtn, marginTop: "24px" }}
      >
        Back to Quizzes
      </button>
    </div>
  );
}
