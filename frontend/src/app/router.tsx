import { createBrowserRouter, type RouteObject } from "react-router";

import { LoginPage } from "@/pages/LoginPage";
import { SearchPage } from "@/pages/SearchPage";
import { StockPage } from "@/pages/StockPage";

import { Layout } from "./Layout";
import { RequireAuth } from "./RequireAuth";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <SearchPage /> },
          { path: "/stock", element: <StockPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(routes);
}
