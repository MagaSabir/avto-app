import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "./router";

describe("Layout", () => {
  it("renders navigation and the stock page at /stock", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/stock"] });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Поиск" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Склад" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Склад" })).toBeInTheDocument();
  });
});
