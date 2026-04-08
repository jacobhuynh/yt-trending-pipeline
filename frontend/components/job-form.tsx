"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YOUTUBE_CATEGORIES, REGIONS, generateIdempotencyKey, getCategoryLabel } from "@/lib/jobs";
import { submitJob } from "@/lib/api";
import { storeJobId, storeJobMeta } from "@/components/jobs-list";
import { Loader2, Send } from "lucide-react";

export function JobForm() {
  const router = useRouter();
  const [region, setRegion] = useState("US");
  const [categoryId, setCategoryId] = useState("28");
  const [maxResults, setMaxResults] = useState("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const idempotencyKey = await generateIdempotencyKey(
        region,
        parseInt(categoryId)
      );
      const res = await submitJob({
        region,
        category_id: parseInt(categoryId),
        max_results: parseInt(maxResults),
        idempotency_key: idempotencyKey,
      });
      storeJobId(res.job_id);
      storeJobMeta(res.job_id, parseInt(maxResults));
      router.push(`/jobs/${res.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white">Submit Job</CardTitle>
        <CardDescription className="text-zinc-400">
          Fetch trending YouTube videos for a region and category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="region" className="text-zinc-300">
              Region
            </Label>
            <Select value={region} onValueChange={(v) => v && setRegion(v)}>
              <SelectTrigger
                id="region"
                className="bg-zinc-800 border-zinc-700 text-white"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                {REGIONS.map((r) => (
                  <SelectItem
                    key={r.code}
                    value={r.code}
                    className="focus:bg-zinc-700"
                  >
                    {r.label} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-zinc-300">
              Category
            </Label>
            <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
              <SelectTrigger
                id="category"
                className="bg-zinc-800 border-zinc-700 text-white"
              >
                <span data-slot="select-value" className="flex flex-1 text-left">
                  {getCategoryLabel(parseInt(categoryId))}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                {YOUTUBE_CATEGORIES.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={String(c.id)}
                    className="focus:bg-zinc-700"
                  >
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxResults" className="text-zinc-300">
              Max Results
            </Label>
            <Input
              id="maxResults"
              type="number"
              min={1}
              max={200}
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Job
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
