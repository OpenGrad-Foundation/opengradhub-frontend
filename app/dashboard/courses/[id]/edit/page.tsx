import { redirect } from "next/navigation";

export default async function LegacyCourseEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/course-management/${id}?tab=settings`);
}
