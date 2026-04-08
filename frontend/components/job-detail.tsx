"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { JobStatusBadge } from "@/components/job-status-badge";
import { getJobStatus, watchJob } from "@/lib/api";
import {
  formatTimestamp,
  isTerminalState,
  getCategoryLabel,
} from "@/lib/jobs";
import type { JobStatus, JobUpdate } from "@/types/jobs";
import { Loader2, ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobDetailProps {
  jobId: string;
}


function StatRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-4">
      <span className="text-zinc-400 text-sm shrink-0">{label}</span>
      <span className="text-zinc-100 text-sm text-right break-all">{value}</span>
    </div>
  );
}

export function JobDetail({ jobId }: JobDetailProps) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  useEffect(() => {
    getJobStatus(jobId)
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load job");
        setLoading(false);
      });
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    if (isTerminalState(job.state)) return;

    setLiveConnected(true);
    const stop = watchJob(
      jobId,
      (data) => {
        const update = data as JobUpdate;
        setUpdates((prev) => [update, ...prev].slice(0, 50));
        setJob((prev) =>
          prev
            ? {
                ...prev,
                state: update.state,
                videos_fetched: update.videos_fetched,
                videos_inserted: update.videos_inserted,
              }
            : prev
        );
        if (isTerminalState(update.state)) {
          setLiveConnected(false);
          // Fetch full status once terminal
          getJobStatus(jobId).then(setJob).catch(() => {});
        }
      },
      () => setLiveConnected(false)
    );

    return () => {
      stop();
      setLiveConnected(false);
    };
  }, [jobId, job?.state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading job…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-24">
        <p className="text-red-400 text-sm">{error ?? "Job not found"}</p>
        <Link href="/">
          <Button variant="ghost" className="mt-4 text-zinc-400">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const isActive = !isTerminalState(job.state);
  const progressMax = Math.max(job.videos_fetched ?? 0, job.videos_inserted ?? 0, 1);
  const hasData = (job.videos_fetched ?? 0) > 0 || (job.videos_inserted ?? 0) > 0;
  const fetchedPct = hasData
    ? Math.min(100, Math.round(((job.videos_fetched ?? 0) / progressMax) * 100))
    : null;
  const insertedPct = hasData
    ? Math.min(100, Math.round(((job.videos_inserted ?? 0) / progressMax) * 100))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5 bg-zinc-700" />
        <h1 className="text-lg font-semibold text-white">Job Detail</h1>
        {!isTerminalState(job.state) && (
          <div className="flex items-center gap-1.5 ml-auto">
            {liveConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Connecting…</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-mono text-sm">
                {job.job_id}
              </CardTitle>
              <JobStatusBadge state={job.state} />
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            <Separator className="bg-zinc-800 mb-1" />
            <StatRow label="Region" value={job.region} />
            <Separator className="bg-zinc-800/60" />
            <StatRow
              label="Category"
              value={`${getCategoryLabel(job.category_id)} (${job.category_id})`}
            />
            <Separator className="bg-zinc-800/60" />
            <StatRow
              label="Attempt"
              value={`${(job.attempt ?? 0) + 1} / ${job.max_attempts ?? 0}`}
            />
            <Separator className="bg-zinc-800/60" />
            <StatRow label="Created" value={formatTimestamp(job.created_at)} />
            <Separator className="bg-zinc-800/60" />
            <StatRow label="Started" value={formatTimestamp(job.started_at)} />
            <Separator className="bg-zinc-800/60" />
            <StatRow
              label="Completed"
              value={formatTimestamp(job.completed_at)}
            />
            {job.next_retry_at && (
              <>
                <Separator className="bg-zinc-800/60" />
                <StatRow
                  label="Next Retry"
                  value={formatTimestamp(job.next_retry_at)}
                />
              </>
            )}
            {job.error_message && (
              <>
                <Separator className="bg-zinc-800 mt-1" />
                <div className="py-3">
                  <p className="text-xs text-zinc-400 mb-1.5">Error</p>
                  <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded px-3 py-2 font-mono">
                    {job.error_message}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Progress + updates */}
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-sm">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Videos Fetched</span>
                  <span className="text-zinc-200 font-mono">
                    {job.videos_fetched ?? 0}
                  </span>
                </div>
                {fetchedPct === null && isActive ? (
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-blue-500 animate-[indeterminate_1.4s_ease-in-out_infinite]" />
                  </div>
                ) : (
                  <Progress
                    value={fetchedPct ?? 100}
                    className="h-2 bg-zinc-800 [&>div]:bg-blue-500 [&>div>div]:transition-[width] [&>div>div]:duration-500 [&>div>div]:ease-out"
                  />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Videos Inserted</span>
                  <span className="text-zinc-200 font-mono">
                    {job.videos_inserted ?? 0} / {job.videos_fetched ?? 0}
                  </span>
                </div>
                {insertedPct === null && isActive ? (
                  <div className="h-2 w-full rounded-full bg-zinc-800" />
                ) : (
                  <Progress
                    value={insertedPct ?? 100}
                    className="h-2 bg-zinc-800 [&>div]:bg-emerald-500 [&>div>div]:transition-[width] [&>div>div]:duration-500 [&>div>div]:ease-out"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {updates.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">
                  Live Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {updates.map((u, i) => (
                    <div
                      key={i}
                      className="text-xs border border-zinc-800 rounded px-2.5 py-2 bg-zinc-800/40"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <JobStatusBadge state={u.state} />
                        <span className="text-zinc-500 font-mono text-[10px]">
                          {formatTimestamp(u.occurred_at)}
                        </span>
                      </div>
                      {u.message && (
                        <p className="text-zinc-400 mt-1">{u.message}</p>
                      )}
                      <p className="text-zinc-500 mt-0.5">
                        fetched {u.videos_fetched} · inserted{" "}
                        {u.videos_inserted}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
