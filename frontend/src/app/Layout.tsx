import { NavLink, Outlet, useLocation } from "react-router";

import { getLastSearch } from "@/features/search/lastSearch";
import { cn } from "@/lib/utils";

import { ServerStatus } from "./ServerStatus";
import { ThemeToggle } from "./ThemeToggle";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "cursor-pointer rounded-lg px-3 py-1.5 font-medium",
    isActive
      ? "bg-selected text-foreground"
      : "text-muted-foreground hover:bg-selected",
  );
}

export function Layout() {
  // Re-render on navigation so "Поиск" points at the latest search.
  useLocation();
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2">
        <span className="font-semibold">Автозапчасти</span>
        <nav className="flex gap-1">
          <NavLink to={`/${getLastSearch()}`} end className={navClass}>
            Поиск
          </NavLink>
          <NavLink to="/stock" className={navClass}>
            Склад
          </NavLink>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <ServerStatus />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
