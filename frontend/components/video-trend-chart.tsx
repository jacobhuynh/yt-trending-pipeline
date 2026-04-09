"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getVideoTrend, getVideos } from "@/lib/api";
import type { TrendPoint } from "@/types/videos";
import type { Video } from "@/types/videos";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface ChartDataPoint {
  time: string;
  Views: number;
  Likes: number;
  Comments: number;
}

interface Props {
  videoId: string;
}

export function VideoTrendChart({ videoId }: Props) {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [trendData, videos] = await Promise.all([
          getVideoTrend(videoId),
          getVideos({ limit: 200 }),
        ]);
        setTrend(trendData ?? []);
        const found = (videos ?? []).find((v) => v.video_id === videoId);
        setVideo(found ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load trend data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [videoId]);

  const chartData: ChartDataPoint[] = trend.map((p) => ({
    time: formatDate(p.fetched_at),
    Views: p.view_count,
    Likes: p.like_count,
    Comments: p.comment_count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/videos">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Videos
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5 bg-zinc-700" />
        <h1 className="text-lg font-semibold text-white">Video Trend</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading trend data…
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {video && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <a
                      href={`https://youtube.com/watch?v=${videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white font-semibold hover:text-blue-400 flex items-start gap-1.5"
                    >
                      <span className="flex-1">{video.title}</span>
                      <ExternalLink className="h-4 w-4 shrink-0 mt-0.5 opacity-60" />
                    </a>
                    <p className="text-zinc-400 text-sm mt-1">{video.channel_title}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Views</p>
                      <p className="text-white font-mono text-sm font-semibold mt-0.5">
                        {formatCount(video.view_count)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Likes</p>
                      <p className="text-white font-mono text-sm font-semibold mt-0.5">
                        {formatCount(video.like_count)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Comments</p>
                      <p className="text-white font-mono text-sm font-semibold mt-0.5">
                        {formatCount(video.comment_count)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {trend.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="py-16 text-center text-zinc-500 text-sm">
                No trend data available for this video yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Trends</h2>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Views Over Time</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {trend.length} data point{trend.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "#3f3f46" }}
                      />
                      <YAxis
                        tickFormatter={formatCount}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#f4f4f5",
                        }}
                        formatter={(value) => (typeof value === "number" ? formatCount(value) : value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="Views"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#3b82f6" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Likes Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "#3f3f46" }}
                      />
                      <YAxis
                        tickFormatter={formatCount}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#f4f4f5",
                        }}
                        formatter={(value) => (typeof value === "number" ? formatCount(value) : value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="Likes"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#10b981" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Comments Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "#3f3f46" }}
                      />
                      <YAxis
                        tickFormatter={formatCount}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#f4f4f5",
                        }}
                        formatter={(value) => (typeof value === "number" ? formatCount(value) : value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="Comments"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#f59e0b" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
