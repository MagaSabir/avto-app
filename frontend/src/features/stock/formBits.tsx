import type { ReactNode } from "react";

import { ApiError } from "@/api/client";

export function cents(v: string): bigint {
  return BigInt(v.replace(".", ""));
}

export function errorText(error: Error): string {
  if (
    error instanceof ApiError &&
    error.status === 422 &&
    error.message.startsWith("HTTP ")
  ) {
    return "Проверьте введённые данные";
  }
  return error.message;
}

export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
