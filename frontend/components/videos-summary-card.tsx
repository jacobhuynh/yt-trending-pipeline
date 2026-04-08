"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getVideoCount, getTrackedRegions } from "@/lib/api";
import { Film, Globe, ArrowRight, Loader2 } from "lucide-react";

export function VideosSummaryCard() {
  const [count, setCount] = useState<number | null>(null);
  const [regionCount, setRegionCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [loadingRegions, setLoadingRegions] = useState(true);

  useEffect(() => {
    getVideoCount()
      .then((n) => setCount(n))
      .catch(() => setCount(null))
      .finally(() => setLoadingCount(false));
    getTrackedRegions()
      .then((d) => setRegionCount(d.count))
      .catch(() => setRegionCount(null))
      .finally(() => setLoadingRegions(false));
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wide">
                Videos Ingested
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {loadingCount ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500 inline" />
                ) : count != null ? (
                  count.toLocaleString()
                ) : (
                  "—"
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
                {loadingRegions ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500 inline" />
                ) : regionCount != null ? (
                  regionCount.toLocaleString()
                ) : (
                  "—"
                )}
              </p>
            </div>
            <Globe className="h-8 w-8 text-zinc-700" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
        <CardContent className="pt-5 pb-4 h-full">
          <Link
            href="/videos"
            className="flex items-center justify-between h-full"
          >
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wide">
                Browse Videos
              </p>
              <p className="text-sm text-zinc-300 mt-1">
                Filter, sort &amp; explore
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-500" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
