import { VideoTrendChart } from "@/components/video-trend-chart";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoTrendPage({ params }: PageProps) {
  const { id } = await params;
  return <VideoTrendChart videoId={id} />;
}
