"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getQuizLeaderboard, type QuizLeaderboard } from "@/lib/api";

const page: React.CSSProperties  = { maxWidth: "760px", margin: "0 auto", padding: "32px 16px", color: "#034852" };
const card: React.CSSProperties  = { background: "rgba(255,255,255,0.85)", borderRadius: "16px", padding: "28px 32px", boxShadow: "0 2px 24px rgba(3,72,82,0.08)", marginBottom: "20px" };
const label: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 };

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
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
      <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading leaderboard…</p>
    </div>
  );

  if (error) return (
    <div style={page}>
      <div style={card}>
        <p style={{ color: "#e53e3e", fontSize: "15px", fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.back()} style={{ marginTop: "16px", padding: "10px 20px", borderRadius: "10px", border: "none", background: "rgba(3,72,82,0.08)", color: "#034852", fontWeight: 700, cursor: "pointer" }}>Go back</button>
      </div>
    </div>
  );

  if (!board) return null;

  return (
    <div style={page}>
      <button
        onClick={() => router.push(`/dashboard/quiz/${quizId}`)}
        style={{ fontSize: "13px", color: "#209379", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "20px", display: "block" }}
      >
        ← Back to Quiz
      </button>

      <div style={card}>
        <p style={label}>Leaderboard</p>
        <p style={{ fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 700, color: "#034852", margin: "8px 0 0" }}>
          PG Programme Rankings
        </p>
        {board.viewer_rank != null && (
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", margin: "6px 0 0" }}>
            Your rank: <strong style={{ color: "#034852" }}>#{board.viewer_rank}</strong> of {board.rankings.length}
          </p>
        )}
      </div>

      {board.rankings.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "48px" }}>
          <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>No completed attempts yet.</p>
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
                  padding: "14px 20px", borderRadius: "14px",
                  background: isMe ? "rgba(10,190,98,0.08)" : "rgba(255,255,255,0.8)",
                  border: isMe ? "2px solid rgba(10,190,98,0.35)" : "1px solid rgba(3,72,82,0.07)",
                  boxShadow: "0 2px 8px rgba(3,72,82,0.05)",
                }}
              >
                {/* Rank */}
                <div style={{ width: "36px", textAlign: "center", flexShrink: 0 }}>
                  {entry.rank <= 3
                    ? <span style={{ fontSize: "20px" }}>{MEDAL[entry.rank - 1]}</span>
                    : <span style={{ fontSize: "15px", fontWeight: 800, color: "rgba(3,72,82,0.4)" }}>#{entry.rank}</span>
                  }
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: isMe ? 800 : 600, color: "#034852", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.name}{isMe && <span style={{ fontSize: "11px", color: "#0abe62", marginLeft: "8px", fontWeight: 700 }}>YOU</span>}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.45)" }}>
                    {entry.correct_count} correct
                  </p>
                </div>

                {/* Score */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: entry.rank === 1 ? "#0abe62" : "#034852" }}>
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
        style={{ marginTop: "24px", padding: "11px 22px", border: "none", borderRadius: "12px", background: "rgba(3,72,82,0.07)", color: "#034852", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
      >
        Back to Quizzes
      </button>
    </div>
  );
}
