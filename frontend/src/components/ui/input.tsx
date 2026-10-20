import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-[38px] w-full rounded-lg border bg-input px-3 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
