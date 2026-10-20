import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { createAppRouter } from "./app/router";
import { applyTheme, readTheme } from "./app/theme";
import "./index.css";

applyTheme(readTheme());

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});
const router = createAppRouter();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
