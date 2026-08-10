// Bare layout for printable pages: inherits the ROOT layout's providers
// (auth, query client) but none of the dashboard chrome — sidebars and
// topbars must not exist on a page that becomes a physical A4 sheet.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
