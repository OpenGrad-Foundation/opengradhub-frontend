"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function PasswordResetGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const isResetRequired = Boolean(user?.publicMetadata?.passwordResetRequired);

  useEffect(() => {
    if (!isLoaded || !user) return;

    if (isResetRequired && pathname !== "/reset-password") {
      router.replace("/reset-password");
    }
  }, [user, isLoaded, pathname, router, isResetRequired]);

  // If reset is required, prevent children from rendering
  if (isLoaded && user && isResetRequired && pathname !== "/reset-password") {
    return null;
  }

  return <>{children}</>;
}
