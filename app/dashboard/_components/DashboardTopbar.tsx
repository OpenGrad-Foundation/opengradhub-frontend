"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import NotificationBell from "@/components/NotificationBell";

export default function DashboardTopbar() {
  const { data } = useCurrentUser();
  const userId = data?.user?.id ?? "";

  return (
    <header style={{
      height: "52px",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingInline: "32px",
      borderBottom: "1px solid rgba(3,72,82,0.06)",
      background: "rgba(255,255,255,0.6)",
      backdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 20,
      gap: "8px",
    }}>
      {userId && <NotificationBell recipientId={userId} />}
    </header>
  );
}
