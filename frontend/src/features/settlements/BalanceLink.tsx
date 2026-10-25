import { NavLink } from "react-router";

import { useBalance } from "@/api/settlements";
import { cn } from "@/lib/utils";

import { formatSigned } from "./format";

export function BalanceLink() {
  const { data, isPending, error } = useBalance();
  const balance = data?.data?.balance;
  const reason = error?.message ?? data?.message ?? undefined;
  return (
    <NavLink
      to="/settlements"
      title={balance === undefined ? reason : undefined}
      className="cursor-pointer rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-selected"
    >
      Баланс:{" "}
      {isPending ? (
        "…"
      ) : balance === undefined ? (
        "—"
      ) : (
        <span
          className={cn(
            "font-[650] text-foreground",
            balance.startsWith("-") && "text-destructive",
          )}
        >
          {formatSigned(balance)}
        </span>
      )}
    </NavLink>
  );
}
