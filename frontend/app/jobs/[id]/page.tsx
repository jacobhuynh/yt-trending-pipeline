import { JobDetail } from "@/components/job-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <JobDetail jobId={id} />;
}
