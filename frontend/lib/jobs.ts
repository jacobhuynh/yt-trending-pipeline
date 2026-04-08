import type { ProtoTimestamp } from "@/types/jobs";

export const JOB_STATES: Record<number, string> = {
  0: "JOB_STATE_UNSPECIFIED",
  1: "JOB_STATE_DONE",
  2: "JOB_STATE_FAILED",
  3: "JOB_STATE_QUEUED",
  4: "JOB_STATE_RUNNING",
  5: "JOB_STATE_RETRYING",
  6: "JOB_STATE_DEAD",
};

export const JOB_STATE_LABELS: Record<number, string> = {
  0: "Unspecified",
  1: "Done",
  2: "Failed",
  3: "Queued",
  4: "Running",
  5: "Retrying",
  6: "Dead",
};

export type StateVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "running";

export const JOB_STATE_VARIANT: Record<number, StateVariant> = {
  0: "secondary",
  1: "success",
  2: "destructive",
  3: "secondary",
  4: "running",
  5: "warning",
  6: "destructive",
};

export function protoTimestampToDate(ts?: ProtoTimestamp): Date | null {
  if (!ts) return null;
  return new Date(ts.seconds * 1000 + Math.floor(ts.nanos / 1_000_000));
}

export function formatTimestamp(ts?: ProtoTimestamp): string {
  const date = protoTimestampToDate(ts);
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatRelativeTime(ts?: ProtoTimestamp): string {
  const date = protoTimestampToDate(ts);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatTimestamp(ts);
}

export async function generateIdempotencyKey(
  region: string,
  categoryId: number
): Promise<string> {
  const currentHour = Math.floor(Date.now() / 3_600_000);
  const input = `${region}${categoryId}${currentHour}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export const YOUTUBE_CATEGORIES: { id: number; label: string }[] = [
  { id: 0, label: "All Categories" },
  { id: 1, label: "Film & Animation" },
  { id: 2, label: "Autos & Vehicles" },
  { id: 10, label: "Music" },
  { id: 15, label: "Pets & Animals" },
  { id: 17, label: "Sports" },
  { id: 19, label: "Travel & Events" },
  { id: 20, label: "Gaming" },
  { id: 22, label: "People & Blogs" },
  { id: 23, label: "Comedy" },
  { id: 24, label: "Entertainment" },
  { id: 25, label: "News & Politics" },
  { id: 26, label: "Howto & Style" },
  { id: 27, label: "Education" },
  { id: 28, label: "Science & Technology" },
  { id: 29, label: "Nonprofits & Activism" },
];

export const REGIONS: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "JP", label: "Japan" },
  { code: "BR", label: "Brazil" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "KR", label: "South Korea" },
  { code: "MX", label: "Mexico" },
  { code: "IT", label: "Italy" },
];

export function getCategoryLabel(id: number | null | undefined): string {
  if (id == null || isNaN(id)) return "All Categories";
  return YOUTUBE_CATEGORIES.find((c) => c.id === id)?.label ?? `Category ${id}`;
}

export function isTerminalState(state: number): boolean {
  return state === 1 || state === 2 || state === 6;
}
