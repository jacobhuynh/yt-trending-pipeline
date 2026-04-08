import { VideosTable } from "@/components/videos-table";

export default function VideosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Videos</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Browse trending videos ingested by the pipeline.
        </p>
      </div>
      <VideosTable />
    </div>
  );
}
