"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function NotFound() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (data?.user) {
      router.replace("/dashboard");
      return;
    }

    router.replace("/");
  }, [data, isLoading, router]);

  return null;
}
