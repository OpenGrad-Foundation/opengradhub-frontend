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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <DashboardTopbar />
        <main className="flex-1 px-6 py-6 sm:px-8 sm:py-8 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
