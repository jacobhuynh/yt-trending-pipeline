import { Badge } from "@/components/ui/badge";
import { JOB_STATE_LABELS } from "@/lib/jobs";
import { cn } from "@/lib/utils";

interface JobStatusBadgeProps {
  state: number;
  className?: string;
}

const stateStyles: Record<number, string> = {
  0: "bg-zinc-700 text-zinc-300 border-zinc-600",
  1: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  2: "bg-red-900/60 text-red-300 border-red-700",
  3: "bg-zinc-700 text-zinc-300 border-zinc-600",
  4: "bg-blue-900/60 text-blue-300 border-blue-700",
  5: "bg-amber-900/60 text-amber-300 border-amber-700",
  6: "bg-red-950/60 text-red-400 border-red-800",
};

export function JobStatusBadge({ state, className }: JobStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-xs border",
        stateStyles[state] ?? stateStyles[0],
        className
      )}
    >
      {JOB_STATE_LABELS[state] ?? "Unknown"}
    </Badge>
  );
}
