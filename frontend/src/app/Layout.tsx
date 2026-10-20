import { NavLink, Outlet } from "react-router";

import { cn } from "@/lib/utils";

import { ServerStatus } from "./ServerStatus";
import { ThemeToggle } from "./ThemeToggle";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-3 py-1.5 font-medium",
    isActive ? "bg-selected text-foreground" : "text-muted-foreground",
  );
}

export function Layout() {
  return (
    <>
      <header className="flex items-center gap-4 border-b bg-card px-4 py-2">
        <span className="font-semibold">Автозапчасти</span>
        <nav className="flex gap-1">
          <NavLink to="/" end className={navClass}>
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
