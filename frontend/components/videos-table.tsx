"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { getVideos } from "@/lib/api";
import { REGIONS, YOUTUBE_CATEGORIES } from "@/lib/jobs";
import type { Video } from "@/types/videos";
import {
  Loader2,
  ExternalLink,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react";

const PAGE_SIZE = 25;

type SortKey = "view_count" | "like_count" | "comment_count";
type SortDir = "desc" | "asc";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (col !== sortKey) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return sortDir === "desc" ? (
    <ArrowDown className="h-3 w-3 ml-1 text-blue-400" />
  ) : (
    <ArrowUp className="h-3 w-3 ml-1 text-blue-400" />
  );
}

export function VideosTable() {
  const [region, setRegion] = useState("US");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("view_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVideos({
        region,
        category_id: categoryId !== "all" ? parseInt(categoryId) : undefined,
        limit: 200,
        offset: 0,
      });
      setVideos(data ?? []);
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch videos");
    } finally {
      setLoading(false);
    }
  }, [region, categoryId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? videos.filter(
        (v) =>
          v.title.toLowerCase().includes(searchLower) ||
          v.channel_title.toLowerCase().includes(searchLower)
      )
    : videos;

  const sorted = [...filtered].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageSlice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <CardTitle className="text-white">Video Browser</CardTitle>
            <CardDescription className="text-zinc-400">
              {loading
                ? "Loading…"
                : search
                ? `${sorted.length} of ${videos.length} videos · page ${page + 1} of ${Math.max(1, totalPages)}`
                : `${videos.length} videos · page ${page + 1} of ${Math.max(1, totalPages)}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search titles or channels…"
                className="pl-7 h-8 w-56 bg-zinc-800 border-zinc-700 text-white text-xs placeholder:text-zinc-500"
              />
            </div>
            <Select value={region} onValueChange={(v) => v && setRegion(v)}>
              <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                {REGIONS.map((r) => (
                  <SelectItem key={r.code} value={r.code} className="focus:bg-zinc-700 text-xs">
                    {r.label} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
              <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700 text-white text-xs h-8">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                {YOUTUBE_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id === 0 ? "all" : String(c.id)} className="focus:bg-zinc-700 text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading videos…
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400 text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchVideos}
              className="mt-3 text-zinc-400"
            >
              Retry
            </Button>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm">
            No videos found for this filter.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-[40%]">Title</TableHead>
                  <TableHead className="text-zinc-400">Channel</TableHead>
                  <TableHead
                    className="text-zinc-400 cursor-pointer select-none"
                    onClick={() => toggleSort("view_count")}
                  >
                    <span className="flex items-center">
                      Views
                      <SortIcon col="view_count" sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-zinc-400 cursor-pointer select-none"
                    onClick={() => toggleSort("like_count")}
                  >
                    <span className="flex items-center">
                      Likes
                      <SortIcon col="like_count" sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-zinc-400 cursor-pointer select-none"
                    onClick={() => toggleSort("comment_count")}
                  >
                    <span className="flex items-center">
                      Comments
                      <SortIcon col="comment_count" sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </TableHead>
                  <TableHead className="text-zinc-400 w-16">Trends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageSlice.map((v) => (
                  <TableRow
                    key={`${v.video_id}-${v.fetched_at}`}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-zinc-100 text-sm max-w-0">
                      <a
                        href={`https://youtube.com/watch?v=${v.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-400 flex items-center gap-1.5 min-w-0"
                      >
                        <span className="truncate">{v.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                      </a>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-xs">
                      {v.channel_title}
                    </TableCell>
                    <TableCell className="text-zinc-300 text-xs font-mono">
                      {formatCount(v.view_count)}
                    </TableCell>
                    <TableCell className="text-zinc-300 text-xs font-mono">
                      {formatCount(v.like_count)}
                    </TableCell>
                    <TableCell className="text-zinc-300 text-xs font-mono">
                      {formatCount(v.comment_count)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/videos/${v.video_id}/trend`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"
                          title="View trend"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
                <span className="text-xs text-zinc-500">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{" "}
                  {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-zinc-400 px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
