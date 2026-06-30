import DOMPurify from "dompurify";

// dompurify requires a browser DOM. Callers must be "use client" components
// behind data-fetch loading guards so this is never reached during SSR.
// Throw on server rather than silently passing raw HTML (fail-closed).
export function sanitize(html: string): string {
  if (typeof window === "undefined") {
    throw new Error("sanitize() called in a non-browser environment — move this call behind a loading guard or use client boundary");
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
