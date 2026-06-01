"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useSuperAdminOverview } from "@/lib/queries/dashboard/super-admin/use-overview";

export default function SuperAdminOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useSuperAdminOverview(userId);
  return <GenericOverview role="SUPER_ADMIN" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
