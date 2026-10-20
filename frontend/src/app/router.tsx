import { createBrowserRouter, type RouteObject } from "react-router";

import { SearchPage } from "@/pages/SearchPage";
import { StockPage } from "@/pages/StockPage";

import { Layout } from "./Layout";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: "/", element: <SearchPage /> },
      { path: "/stock", element: <StockPage /> },
    ],
  },
];

export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(routes);
}
