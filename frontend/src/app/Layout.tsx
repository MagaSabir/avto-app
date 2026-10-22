import { UserRound } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";

import { displayName, useMe } from "@/api/auth";
import { Logo } from "@/components/Logo";

import { getLastSearch } from "@/features/search/lastSearch";
import { BalanceLink } from "@/features/settlements/BalanceLink";
import { cn } from "@/lib/utils";

import { ServerStatus } from "./ServerStatus";
import { ThemeToggle } from "./ThemeToggle";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "-mb-px flex h-full cursor-pointer items-center border-b-2 px-1 font-medium",
    isActive
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

export function Layout() {
  // On the search page its own address is the latest search; elsewhere the
  // remembered one (read on every navigation).
  const location = useLocation();
  const search = location.pathname === "/" ? location.search : getLastSearch();
  const { data: me } = useMe();

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-8 gap-y-1 border-b bg-card px-4 sm:px-8">
        <NavLink to={`/${search}`} aria-label="Поиск" end className="py-2">
          <Logo className="h-7 w-auto" />
        </NavLink>
        <nav className="order-last flex h-11 w-full gap-6 self-stretch sm:order-none sm:h-14 sm:w-auto">
          <NavLink to={`/${search}`} end className={navClass}>
            Поиск
          </NavLink>
          <NavLink to="/stock" className={navClass}>
            Склад
          </NavLink>
          <NavLink to="/settlements" className={navClass}>
            Взаиморасчёты
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 py-2">
          <ThemeToggle />
          <BalanceLink />
          <NavLink
            to="/profile"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-selected hover:text-foreground"
          >
            <UserRound size={16} aria-hidden="true" />
            <span>{me ? displayName(me) : ""}</span>
          </NavLink>
        </div>
      </header>
      <ServerStatus />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
