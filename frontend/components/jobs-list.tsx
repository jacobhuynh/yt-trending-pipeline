"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobStatusBadge } from "@/components/job-status-badge";
import { getJobStatus } from "@/lib/api";
import { formatRelativeTime, getCategoryLabel } from "@/lib/jobs";
import type { JobStatus } from "@/types/jobs";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "yt_etl_job_ids";
const META_KEY = "yt_etl_job_meta";
const MAX_STORED = 20;

export function storeJobId(jobId: string) {
  if (typeof window === "undefined") return;
  const existing: string[] = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]"
  );
  const updated = [jobId, ...existing.filter((id) => id !== jobId)].slice(
    0,
    MAX_STORED
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function storeJobMeta(jobId: string, maxResults: number) {
  if (typeof window === "undefined") return;
  const meta: Record<string, { maxResults: number }> = JSON.parse(
    localStorage.getItem(META_KEY) ?? "{}"
  );
  meta[jobId] = { maxResults };
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function getJobMaxResults(jobId: string): number | null {
  if (typeof window === "undefined") return null;
  const meta: Record<string, { maxResults: number }> = JSON.parse(
    localStorage.getItem(META_KEY) ?? "{}"
  );
  return meta[jobId]?.maxResults ?? null;
}

function getStoredJobIds(): string[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
}


export function JobsList() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const ids = getStoredJobIds();
    if (ids.length === 0) {
      setJobs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => getJobStatus(id)));
    const fetched: JobStatus[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") fetched.push(r.value);
    }
    setJobs(fetched);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchJobs(false);
    const interval = setInterval(() => fetchJobs(true), 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Listen for new jobs submitted in the same tab
  useEffect(() => {
    const handler = () => fetchJobs(true);
    window.addEventListener("job_submitted", handler);
    return () => window.removeEventListener("job_submitted", handler);
  }, [fetchJobs]);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-white">Recent Jobs</CardTitle>
          <CardDescription className="text-zinc-400">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString()}`
              : "Auto-refreshes every 5 seconds"}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchJobs(false)}
          disabled={refreshing}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800 mt-0"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-sm">No jobs yet.</p>
            <p className="text-xs mt-1">Submit a job above to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Job ID</TableHead>
                <TableHead className="text-zinc-400">Region</TableHead>
                <TableHead className="text-zinc-400">Category</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Videos</TableHead>
                <TableHead className="text-zinc-400">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.job_id}
                  className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/jobs/${job.job_id}`}
                      className="font-mono text-xs text-blue-400 hover:text-blue-300"
                    >
                      {job.job_id.slice(0, 8)}…
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-300 font-mono text-xs">
                    {job.region}
                  </TableCell>
                  <TableCell className="text-zinc-300 text-xs">
                    {getCategoryLabel(job.category_id)}
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge state={job.state} />
                  </TableCell>
                  <TableCell className="text-zinc-300 text-xs">
                    {job.videos_inserted ?? 0}/{job.videos_fetched ?? 0}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-xs">
                    {formatRelativeTime(job.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
