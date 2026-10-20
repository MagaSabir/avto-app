import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";

import { DefaultMarkupField } from "./DefaultMarkupField";

afterEach(() => vi.unstubAllGlobals());

it("shows and saves default markup on blur", async () => {
  let body = "";
  mockApi({
    "GET /api/settings": () => ({ default_markup: "30.00" }),
    "PATCH /api/settings": (init) => {
      body = init.body as string;
      return { default_markup: "25.00" };
    },
  });
  renderWithProviders(<DefaultMarkupField />);
  const input = await screen.findByDisplayValue("30");
  fireEvent.change(input, { target: { value: "25" } });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(body).toBe('{"default_markup":"25.00"}');
  });
});
