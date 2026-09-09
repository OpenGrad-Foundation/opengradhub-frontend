/**
 * Structural icons for the class list.
 *
 * These were emoji — 🎥 📹 🔴 🗓️ — which render as a different picture on every
 * platform, cannot be recoloured by a token, and are announced by screen
 * readers as their CLDR name ("movie camera") in the middle of a class title.
 * They are decorative here, so they are hidden from assistive tech entirely and
 * the meaning is carried by the text beside them.
 */
type Props = { className?: string };

const base = "h-5 w-5 shrink-0";

export function VideoIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      className={`${base} ${className}`}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3z" />
    </svg>
  );
}

/** A past class: the same camera, played back. */
export function RecordedIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      className={`${base} ${className}`}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3z" />
      <path d="M7 10.5v3l3-1.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CalendarIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      className={`${base} ${className}`}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/**
 * The live dot. Colour alone would carry the whole meaning, so every caller
 * pairs it with the words "Live now".
 */
export function LiveDot({ className = "" }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#c62828] ring-4 ring-[#c62828]/20 ${className}`}
    />
  );
}
