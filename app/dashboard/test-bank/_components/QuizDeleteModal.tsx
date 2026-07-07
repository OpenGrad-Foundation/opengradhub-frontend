"use client";

import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";

interface UniqueQuestion {
  id: string;
  content_html: string;
  question_type: string;
}

interface QuizDeleteModalProps {
  quizTitle: string;
  uniqueQuestions: UniqueQuestion[];
  onConfirm: (selectedQuestionIds: string[]) => Promise<void>;
  onClose: () => void;
}

export function QuizDeleteModal({ quizTitle, uniqueQuestions, onConfirm, onClose }: QuizDeleteModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // By default, select all unique questions
  useEffect(() => {
    setSelectedIds(new Set(uniqueQuestions.map(q => q.id)));
  }, [uniqueQuestions]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(Array.from(selectedIds));
    } finally {
      setIsDeleting(false);
    }
  };

  // Strip HTML for plain text preview
  const stripHtml = (html: string) => {
    if (typeof window === "undefined") return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(3,72,82,0.3)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
    }}>
      <div style={{
        background: "#ffffff", borderRadius: "24px", width: "100%", maxWidth: "600px",
        boxShadow: "0 24px 48px rgba(3,72,82,0.15)", overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "90vh"
      }}>
        {/* Header */}
        <div style={{ padding: "24px", borderBottom: "1px solid rgba(3,72,82,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#e53e3e", margin: 0 }}>
              Delete Quiz
            </p>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852", margin: "4px 0 0 0" }}>
              {quizTitle}
            </h2>
          </div>
          <button onClick={onClose} disabled={isDeleting} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)" }}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          <p style={{ color: "rgba(3,72,82,0.7)", fontSize: "15px", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            This quiz contains <strong>{uniqueQuestions.length} question(s)</strong> that are not used in any other quiz. 
            Would you like to permanently delete them (and their images) as well to keep your Test Bank clean?
          </p>

          <div style={{ background: "rgba(3,72,82,0.02)", border: "1px solid rgba(3,72,82,0.06)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(3,72,82,0.06)", display: "flex", alignItems: "center", gap: "12px", background: "rgba(3,72,82,0.04)" }}>
              <input 
                type="checkbox" 
                checked={selectedIds.size === uniqueQuestions.length && uniqueQuestions.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(uniqueQuestions.map(q => q.id)));
                  else setSelectedIds(new Set());
                }}
                style={{ width: "16px", height: "16px", accentColor: "#e53e3e", cursor: "pointer" }}
              />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.8)" }}>Select All Unique Questions</span>
            </div>
            
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {uniqueQuestions.map(q => (
                <div key={q.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(3,72,82,0.04)", display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer" }} onClick={() => toggleSelect(q.id)}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(q.id)}
                    onChange={() => {}} // handled by parent div onClick
                    style={{ width: "16px", height: "16px", accentColor: "#e53e3e", marginTop: "4px" }}
                  />
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", background: "rgba(3,72,82,0.1)", borderRadius: "4px", color: "#034852", marginRight: "8px" }}>
                      {q.question_type}
                    </span>
                    <span style={{ fontSize: "14px", color: "#034852" }}>
                      {stripHtml(q.content_html).substring(0, 100) || "No text content"}...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 24px", background: "rgba(3,72,82,0.02)", borderTop: "1px solid rgba(3,72,82,0.06)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button 
            onClick={onClose} 
            disabled={isDeleting}
            style={{ padding: "10px 20px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "10px", background: "transparent", color: "#034852", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isDeleting}
            style={{ padding: "10px 20px", border: "none", borderRadius: "10px", background: "#e53e3e", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: isDeleting ? 0.7 : 1 }}
          >
            <Trash2 size={16} />
            {isDeleting ? "Deleting..." : `Delete Quiz + ${selectedIds.size} Question(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
