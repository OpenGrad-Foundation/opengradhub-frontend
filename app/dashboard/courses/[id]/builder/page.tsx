import { redirect } from "next/navigation";

export default async function LegacyCourseBuilderRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/course-management/${id}?tab=curriculum`);
}
