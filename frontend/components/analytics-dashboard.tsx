"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTopChannels, getVideos } from "@/lib/api";
import { REGIONS } from "@/lib/jobs";
import type { TopChannel, Video } from "@/types/videos";
import { Loader2, Trophy, Film, Globe } from "lucide-react";

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const BAR_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#818cf8",
  "#60a5fa",
  "#38bdf8",
  "#34d399",
  "#4ade80",
];

export function AnalyticsDashboard() {
  const [region, setRegion] = useState("US");
  const [channels, setChannels] = useState<TopChannel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    setChannelsError(null);
    try {
      const data = await getTopChannels({ region, limit: 10 });
      setChannels(data ?? []);
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoadingChannels(false);
    }
  }, [region]);

  const fetchVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const data = await getVideos({ region, limit: 200 });
      setVideos(data ?? []);
    } catch {
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }, [region]);

  useEffect(() => {
    fetchChannels();
    fetchVideos();
  }, [fetchChannels, fetchVideos]);

  const mostViewed = videos.reduce<Video | null>(
    (best, v) => (best == null || v.ViewCount > best.ViewCount ? v : best),
    null
  );

  const chartData = channels.map((c) => ({
    name:
      c.ChannelTitle.length > 18
        ? c.ChannelTitle.slice(0, 17) + "…"
        : c.ChannelTitle,
    fullName: c.ChannelTitle,
    Appearances: c.AppearCount,
    "Total Views": c.TotalViews,
  }));

  return (
    <div className="space-y-6">
      {/* Region selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">Region:</span>
        <Select value={region} onValueChange={(v) => v && setRegion(v)}>
          <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700 text-white text-sm h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
            {REGIONS.map((r) => (
              <SelectItem key={r.code} value={r.code} className="focus:bg-zinc-700 text-sm">
                {r.label} ({r.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Videos Ingested
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {loadingVideos ? (
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500 inline" />
                  ) : (
                    videos.length >= 200 ? "200+" : videos.length
                  )}
                </p>
              </div>
              <Film className="h-8 w-8 text-zinc-700" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Regions Tracked
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {REGIONS.length}
                </p>
              </div>
              <Globe className="h-8 w-8 text-zinc-700" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Most Viewed ({region})
                </p>
                {loadingVideos ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500 mt-1" />
                ) : mostViewed ? (
                  <>
                    <p className="text-sm font-semibold text-white mt-1 line-clamp-1">
                      {mostViewed.Title}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono">
                      {formatCount(mostViewed.ViewCount)} views
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500 mt-1">No data</p>
                )}
              </div>
              <Trophy className="h-8 w-8 text-zinc-700 shrink-0 ml-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top channels chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Top Channels by Appearances</CardTitle>
          <CardDescription className="text-zinc-400">
            Channels that appear most often in trending for {region}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingChannels ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : channelsError ? (
            <div className="text-center py-16 text-red-400 text-sm">
              {channelsError}
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-sm">
              No channel data available for {region}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#3f3f46" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#f4f4f5",
                  }}
                  formatter={(value, name) => [
                    name === "Total Views" && typeof value === "number"
                      ? formatCount(value)
                      : value,
                    name,
                  ]}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.fullName ?? _label
                  }
                />
                <Bar
                  dataKey="Appearances"
                  radius={[0, 3, 3, 0]}
                  shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
                    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
                    return <rect x={x} y={y} width={width} height={height} fill={BAR_COLORS[index % BAR_COLORS.length]} rx={3} ry={3} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top channels by total views */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Top Channels by Total Views</CardTitle>
          <CardDescription className="text-zinc-400">
            Cumulative view counts across all trending appearances for {region}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingChannels ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : channels.length === 0 ? null : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCount}
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#3f3f46" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#f4f4f5",
                  }}
                  formatter={(value) => [typeof value === "number" ? formatCount(value) : value, "Total Views"]}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.fullName ?? _label
                  }
                />
                <Bar
                  dataKey="Total Views"
                  radius={[0, 3, 3, 0]}
                  shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
                    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
                    return <rect x={x} y={y} width={width} height={height} fill={BAR_COLORS[index % BAR_COLORS.length]} rx={3} ry={3} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
