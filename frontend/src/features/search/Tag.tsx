import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Small inline plaque: neutral (requested number) or analog (low-status tones).
export function Tag({
  tone,
  children,
}: {
  tone: "neutral" | "analog";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        tone === "neutral"
          ? "border bg-muted text-muted-foreground"
          : "bg-status-low-bg text-status-low",
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-3 animate-pulse rounded bg-border", className)}
    />
  );
}
