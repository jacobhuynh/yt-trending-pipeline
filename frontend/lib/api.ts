import type {
  JobStatus,
  JobResponse,
  BatchResponse,
  SubmitJobRequest,
} from "@/types/jobs";
import type { Video, TopChannel, TrendPoint } from "@/types/videos";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function submitJob(
  req: SubmitJobRequest
): Promise<JobResponse> {
  const res = await fetch(`${BASE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Failed to submit job");
  }
  return res.json();
}

export async function submitBatch(
  reqs: SubmitJobRequest[]
): Promise<BatchResponse> {
  const res = await fetch(`${BASE_URL}/jobs/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqs),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Failed to submit batch");
  }
  return res.json();
}

export async function getJobStatus(id: string): Promise<JobStatus> {
  const res = await fetch(`${BASE_URL}/jobs/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Failed to fetch job");
  }
  return res.json();
}

export function watchJob(
  id: string,
  onUpdate: (data: unknown) => void,
  onError?: (err: Event) => void
): () => void {
  const es = new EventSource(`${BASE_URL}/jobs/${id}/watch`);

  es.addEventListener("update", (e: MessageEvent) => {
    try {
      onUpdate(JSON.parse(e.data));
    } catch {
      // ignore parse errors
    }
  });

  if (onError) {
    es.onerror = onError;
  }

  return () => es.close();
}

export async function getVideos(params: {
  region?: string;
  category_id?: number;
  limit?: number;
  offset?: number;
}): Promise<Video[]> {
  const qs = new URLSearchParams();
  if (params.region) qs.set("region", params.region);
  if (params.category_id != null) qs.set("category_id", String(params.category_id));
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const res = await fetch(`${BASE_URL}/videos?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
}

export async function getTopChannels(params: {
  region?: string;
  limit?: number;
}): Promise<TopChannel[]> {
  const qs = new URLSearchParams();
  if (params.region) qs.set("region", params.region);
  if (params.limit != null) qs.set("limit", String(params.limit));
  const res = await fetch(`${BASE_URL}/analytics/top-channels?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch top channels");
  return res.json();
}

export async function getVideoTrend(id: string): Promise<TrendPoint[]> {
  const res = await fetch(`${BASE_URL}/analytics/videos/${id}/trend`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch video trend");
  return res.json();
}
