"use client";

import { useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { Bug } from "lucide-react";

type FeedbackForm = { appendToDom: () => void; open: () => void };

export default function ReportBugButton() {
  // The form is created once and reused so repeated clicks don't append
  // duplicate dialogs to the DOM.
  const formRef = useRef<FeedbackForm | null>(null);
  const feedback = Sentry.getFeedback();

  if (!feedback) return null;

  // Capture feedback in a local variable so TypeScript knows it's non-null
  // inside the async closure below (the ref check above only guards at render
  // time, not inside the async callback).
  const fb = feedback;

  async function openForm() {
    try {
      if (!formRef.current) {
        const form = await fb.createForm();
        form.appendToDom();
        formRef.current = form;
      }
      formRef.current.open();
    } catch (err) {
      console.error("Failed to open bug report form", err);
    }
  }

  return (
    <button
      type="button"
      onClick={openForm}
      title="Report a bug"
      aria-label="Report a bug"
      className="flex items-center gap-1.5 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
    >
      <Bug size={18} aria-hidden="true" />
      <span className="hidden sm:inline text-sm font-medium">Report bug</span>
    </button>
  );
}
