import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Small inline plaque in the in-stock tones, e.g. "у вас N шт".
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-status-ok-bg px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-status-ok">
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
