import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useLogout, useMe } from "@/api/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

import { getLastSearch } from "@/features/search/lastSearch";
import { BalanceLink } from "@/features/settlements/BalanceLink";
import { cn } from "@/lib/utils";

import { ServerStatus } from "./ServerStatus";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

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
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  const [confirming, setConfirming] = useState(false);

  function closeModal() {
    setConfirming(false);
    logout.reset();
  }

  function confirmLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        void navigate("/login", { replace: true });
      },
    });
  }

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
          <NavLink to="/orders" className={navClass}>
            Заказы
          </NavLink>
          <NavLink to="/settlements" className={navClass}>
            Взаиморасчёты
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 py-2">
          <ThemeToggle />
          <BalanceLink />
          <UserMenu
            login={me?.login ?? ""}
            onLogout={() => {
              setConfirming(true);
            }}
          />
        </div>
      </header>
      <Modal
        open={confirming}
        onClose={closeModal}
        title="Выход"
        className="max-w-[360px]"
      >
        <p className="px-4 py-3">Выйти из учётной записи?</p>
        {logout.isError && (
          <p role="alert" className="px-4 pb-2 text-destructive">
            {logout.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2 px-4 pb-3">
          <Button
            variant="primary"
            disabled={logout.isPending}
            onClick={confirmLogout}
          >
            Да
          </Button>
          <Button disabled={logout.isPending} onClick={closeModal}>
            Нет
          </Button>
        </div>
      </Modal>
      <ServerStatus />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
