type StatCardProps = {
  label: string;
  value?: string;
};

export default function StatCard({ label, value = "--" }: StatCardProps) {
  return (
    <div className="relative rounded-[24px] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
      <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(3,72,82,0.06)] text-[var(--teal)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 5-7" />
        </svg>
      </div>
      <div
        className="text-[32px] font-semibold text-[var(--dark-teal)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {value}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(3,72,82,0.6)]">
        {label}
      </div>
    </div>
  );
}
