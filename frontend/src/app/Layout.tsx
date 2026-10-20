import { NavLink, Outlet } from "react-router";

export function Layout() {
  return (
    <>
      <header>
        <nav>
          <NavLink to="/">Поиск</NavLink> <NavLink to="/stock">Склад</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
