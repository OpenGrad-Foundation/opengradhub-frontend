import Sidebar from "@/components/sidebar";
import DashboardTopbar from "@/app/dashboard/_components/DashboardTopbar";
import { isClerkMode } from "@/lib/auth-session";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side redirect avoids the “dashboard flash” on first login.
  // Applies only to users flagged by backend/user-creation flow.
  if (isClerkMode()) {
    const { userId } = await auth();

    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const isResetRequired = Boolean(user.publicMetadata?.passwordResetRequired);

      if (isResetRequired) {
        redirect("/reset-password");
      }
    }
  }

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
        <div className="flex-1 flex flex-col min-w-0">
          {/* Slim topbar with notification bell */}
          <DashboardTopbar />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
