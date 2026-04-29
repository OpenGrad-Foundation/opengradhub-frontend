import Sidebar from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(0,109,108,0.08), transparent 40%), radial-gradient(circle at bottom left, rgba(10,190,98,0.08), transparent 40%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar />
        <main className="flex-1 px-8 py-10">{children}</main>
      </div>
    </div>
  );
}
