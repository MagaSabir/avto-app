import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useLogout, useMe } from "@/api/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

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
  // On the search page its own address is the latest search; elsewhere the
  // remembered one (read on every navigation).
  const location = useLocation();
  const search = location.pathname === "/" ? location.search : getLastSearch();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2">
        <NavLink to={`/${search}`} aria-label="Поиск" end>
          <Logo className="h-7 w-auto" />
        </NavLink>
        <nav className="flex gap-1">
          <NavLink to={`/${search}`} end className={navClass}>
            Поиск
          </NavLink>
          <NavLink to="/stock" className={navClass}>
            Склад
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">{me?.login}</span>
          <Button
            className="h-auto px-3 py-1.5"
            onClick={() => {
              logout.mutate(undefined, {
                onSettled: () => {
                  void navigate("/login", { replace: true });
                },
              });
            }}
          >
            Выйти
          </Button>
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
