"use client";

import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { Bug } from "lucide-react";

type FeedbackForm = { appendToDom: () => void; open: () => void };
type Feedback = NonNullable<ReturnType<typeof Sentry.getFeedback>>;

export default function ReportBugButton() {
  // The in-flight promise is cached (not the resolved form) so rapid
  // double-clicks share one createForm() call and the DOM never gets
  // duplicate dialogs. Reset on failure so a later click can retry.
  const formRef = useRef<Promise<FeedbackForm> | null>(null);
  // Sentry.getFeedback is browser-only; calling it during SSR throws
  // "getFeedback is not a function" because @sentry/nextjs server bundle
  // omits it. Defer to mount.
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    setFeedback(Sentry.getFeedback() ?? null);
  }, []);

  if (!feedback) return null;
  const fb = feedback;

  async function openForm() {
    try {
      if (!formRef.current) {
        formRef.current = fb.createForm().then((form: FeedbackForm) => {
          form.appendToDom();
          return form;
        });
      }
      (await formRef.current).open();
    } catch (err) {
      formRef.current = null;
      console.error("Failed to open bug report form", err);
    }
  }

  return (
    <button
      type="button"
      onClick={openForm}
      title="Report a bug"
      aria-label="Report a bug"
      className="flex items-center gap-1.5 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer select-none"
    >
      <Bug size={18} aria-hidden="true" />
      <span className="hidden sm:inline text-sm font-medium">Report bug</span>
    </button>
  );
}
