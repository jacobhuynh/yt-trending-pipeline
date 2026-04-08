import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Analytics</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Top channels and aggregate stats across ingested trending data.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
