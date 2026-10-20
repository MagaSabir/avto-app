import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "default";
};

export function Button({
  variant = "default",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "h-[38px] cursor-pointer rounded-lg border px-3.5 font-medium disabled:cursor-default focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50",
        variant === "primary"
          ? "border-primary bg-primary text-primary-foreground enabled:hover:bg-primary/90"
          : "bg-card text-foreground enabled:hover:bg-selected",
        className,
      )}
      {...props}
    />
  );
}
