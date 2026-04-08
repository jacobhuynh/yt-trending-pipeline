import { JobForm } from "@/components/job-form";
import { JobsList } from "@/components/jobs-list";
import { VideosSummaryCard } from "@/components/videos-summary-card";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Submit jobs to fetch trending YouTube videos and monitor their
          progress.
        </p>
      </div>

      <VideosSummaryCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <JobForm />
        </div>
        <div className="lg:col-span-2">
          <JobsList />
        </div>
      </div>
    </div>
  );
}
