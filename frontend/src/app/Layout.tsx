import { NavLink, Outlet } from "react-router";

import { ServerStatus } from "./ServerStatus";

export function Layout() {
  return (
    <>
      <header>
        <nav>
          <NavLink to="/">Поиск</NavLink> <NavLink to="/stock">Склад</NavLink>
        </nav>
        <ServerStatus />
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
