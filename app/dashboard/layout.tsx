import DashboardShell from "@/components/dashboard-shell";
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

  return <DashboardShell>{children}</DashboardShell>;
}
