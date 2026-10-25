import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSupplierSearches } from "@/api/search";
import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer, partGroup, supplierResult } from "@/test/searchFixtures";

import { selectPart } from "./derive";
import { SuppliersBlock } from "./SuppliersBlock";

afterEach(() => {
  vi.unstubAllGlobals();
});

const isBefore = (a: HTMLElement, b: HTMLElement) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const opts = {
  showAnalogs: true,
  sort: "price" as const,
  now: new Date(2026, 9, 21, 10, 0),
};

function Harness(props: { partKey?: string; picking?: boolean }) {
  const queries = useSupplierSearches(["rossko"], "333114", {});
  const ok = queries.flatMap((q) => (q.data?.status === "ok" ? [q.data] : []));
  return (
    <SuppliersBlock
      suppliers={[{ code: "rossko", title: "Росско" }]}
      queries={queries}
      results={props.partKey === undefined ? ok : selectPart(ok, props.partKey)}
      opts={opts}
      stockNumbers={new Map([["290074", 1]])}
      onToStock={vi.fn()}
      picker={props.picking === true ? <p>PICKER</p> : undefined}
    />
  );
}

const BOTH = [
  { code: "rossko", title: "Росско" },
  { code: "mikado", title: "Микадо" },
];

function BothHarness({ onToStock = vi.fn() }: { onToStock?: () => void }) {
  const queries = useSupplierSearches(
    BOTH.map((s) => s.code),
    "W68/3",
    {},
  );
  const ok = queries.flatMap((q) => (q.data?.status === "ok" ? [q.data] : []));
  return (
    <SuppliersBlock
      suppliers={BOTH}
      queries={queries}
      results={ok}
      opts={opts}
      stockNumbers={new Map()}
      onToStock={onToStock}
    />
  );
}

const MANN = { brand: "Mann", number: "W 68/3", number_norm: "W683" };
const rosskoMann = supplierResult({
  groups: [
    partGroup({
      ...MANN,
      key: "MANN|W683",
      offers: [
        offer({ stock_id: "r1", purchase_price: "696.00", qty: 2 }),
        offer({ stock_id: "r2", purchase_price: "513.00", qty: 1000 }),
        offer({ stock_id: "r3", purchase_price: "800.00", qty: 5 }),
      ],
    }),
  ],
});
const mikadoMann = supplierResult({
  code: "mikado",
  title: "Микадо",
  groups: [
    partGroup({
      ...MANN,
      brand: "MANN-FILTER",
      key: "MANN|W683",
      offers: [
        offer({
          warehouse: "Грозный",
          stock_id: "w683m|7",
          purchase_price: "574.75",
          qty: 10,
          qty_plus: true,
          delivery_days: 0,
          order_code: "w683m",
        }),
      ],
    }),
  ],
});

function answerBoth(mikado: object, posts: unknown[] = []) {
  mockApi({
    "GET /api/cart": () => ({ items: [], total: "0.00" }),
    "GET /api/search/suppliers/rossko": () => rosskoMann,
    "GET /api/search/suppliers/mikado": () => mikado,
    "POST /api/cart/items": (init) => {
      posts.push(JSON.parse(init.body as string));
      return {};
    },
  });
  return posts;
}

const twoParts = supplierResult({
  groups: [
    partGroup({ brand: "MANN", key: "MANN|W683" }),
    partGroup({ brand: "MGA", key: "MGA|W683" }),
    partGroup({
      brand: "BOSCH",
      key: "BOSCH|F1",
      is_requested: false,
      analog_of: ["MANN|W683"],
    }),
  ],
});

function answer(result: object | Response) {
  let calls = 0;
  mockApi({
    "GET /api/cart": () => ({ items: [], total: "0.00" }),
    "GET /api/search/suppliers/rossko": () => {
      calls += 1;
      return result;
    },
  });
  return () => calls;
}

describe("SuppliersBlock", () => {
  it("shows the waiting plaque while the supplier answers", () => {
    vi.stubGlobal("fetch", () => new Promise<Response>(() => undefined));
    renderWithProviders(<Harness />);
    expect(screen.getByText("Предложения поставщиков")).toBeInTheDocument();
    expect(screen.getByText("Росско · ждём ответ…")).toBeInTheDocument();
  });

  it("shows the parts count, the part, then its analogs", async () => {
    answer(
      supplierResult({
        groups: [
          partGroup(),
          partGroup({
            brand: "SACHS",
            number: "290 074",
            number_norm: "290074",
            key: "SACHS|290074",
            is_requested: false,
            analog_of: ["KYB|333114"],
          }),
        ],
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Росско · 2 детали")).toBeInTheDocument();
    expect(screen.queryByText(/цены с наценкой/)).not.toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "Аналоги" });
    const sachs = screen.getByText("SACHS");
    expect(isBefore(screen.getByText("KYB"), heading)).toBe(true);
    expect(isBefore(heading, sachs)).toBe(true);
    expect(screen.getByText("у вас 1 шт")).toBeInTheDocument();
    for (const h of ["Бренд", "Номер", "Наименование", "Можно забрать"])
      expect(screen.getAllByText(h).length).toBeGreaterThan(0);
    for (const h of ["Кратн.", "Тип", "Закупка", "К заказу"])
      expect(screen.queryByText(h)).not.toBeInTheDocument();
  });

  it("has no analogs heading without analogs", async () => {
    answer(supplierResult());
    renderWithProviders(<Harness />);
    expect(await screen.findByText("KYB")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Аналоги" }),
    ).not.toBeInTheDocument();
  });

  it("shows the supplier message", async () => {
    answer(supplierResult({ message: "Часть складов не ответила" }));
    renderWithProviders(<Harness />);
    expect(
      await screen.findByText("Часть складов не ответила"),
    ).toBeInTheDocument();
  });

  it("says nothing was found", async () => {
    answer(supplierResult({ groups: [] }));
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.getByText("Росско · 0 деталей")).toBeInTheDocument();
  });

  it("shows a supplier error and retries on request", async () => {
    const calls = answer(
      supplierResult({
        status: "error",
        message: "Росско не отвечает",
        groups: [],
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Росско · ошибка")).toBeInTheDocument();
    expect(screen.getByText("Росско не отвечает")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(calls()).toBe(2);
    });
  });

  it("shows a request failure with retry", async () => {
    answer(
      new Response(JSON.stringify({ detail: "Внутренняя ошибка" }), {
        status: 500,
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Росско · ошибка")).toBeInTheDocument();
    expect(screen.getByText("Внутренняя ошибка")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();
  });

  it("names a supplier error without a message", async () => {
    answer(supplierResult({ status: "error", message: null, groups: [] }));
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Ошибка поставщика")).toBeInTheDocument();
  });

  it("counts parts and shows the picker on step 1", async () => {
    answer(twoParts);
    renderWithProviders(<Harness picking />);
    expect(await screen.findByText("Росско · 2 детали")).toBeInTheDocument();
    expect(screen.getByText("PICKER")).toBeInTheDocument();
    expect(screen.queryByText("BOSCH")).not.toBeInTheDocument();
  });

  it("shows only the chosen part and its analogs on step 2", async () => {
    answer(twoParts);
    renderWithProviders(<Harness partKey="MANN|W683" />);
    expect(await screen.findByText("Росско · 2 детали")).toBeInTheDocument();
    expect(screen.getByText("MANN")).toBeInTheDocument();
    expect(screen.getByText("BOSCH")).toBeInTheDocument();
    expect(screen.queryByText("MGA")).not.toBeInTheDocument();
  });

  it("shows a section per supplier inside one part", async () => {
    answerBoth(mikadoMann);
    renderWithProviders(<BothHarness />);
    expect(
      await screen.findByText("Росско · 3 склада · от 513 ₽"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Микадо · 1 склад · от 574,75 ₽"),
    ).toBeInTheDocument();
    // One part row for both suppliers.
    expect(screen.getAllByText("Mann")).toHaveLength(1);
    const mikado = within(screen.getByRole("group", { name: "Микадо" }));
    expect(mikado.getByText("10+ шт")).toBeInTheDocument();
    expect(mikado.getByText("сегодня")).toBeInTheDocument();
    const rossko = within(screen.getByRole("group", { name: "Росско" }));
    expect(rossko.getByText("513 ₽")).toBeInTheDocument();
    expect(
      rossko.getByRole("button", { name: "Другие склады: 2" }),
    ).toBeInTheDocument();
  });

  it("shows rossko while mikado fails", async () => {
    answerBoth(
      supplierResult({
        code: "mikado",
        title: "Микадо",
        status: "error",
        message: "Микадо недоступен, повторите позже",
        groups: [],
      }),
    );
    renderWithProviders(<BothHarness />);
    expect(await screen.findByText("Микадо · ошибка")).toBeInTheDocument();
    expect(
      screen.getByText("Микадо недоступен, повторите позже"),
    ).toBeInTheDocument();
    expect(screen.getByText("Росско · 1 деталь")).toBeInTheDocument();
    expect(
      screen.getByText("Росско · 3 склада · от 513 ₽"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Микадо" }),
    ).not.toBeInTheDocument();
  });

  it("adds a Mikado offer to the cart with its order code", async () => {
    const posts = answerBoth(mikadoMann);
    const onToStock = vi.fn();
    renderWithProviders(<BothHarness onToStock={onToStock} />);
    const mikado = within(await screen.findByRole("group", { name: "Микадо" }));
    fireEvent.click(mikado.getByRole("button", { name: "В корзину" }));
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).toMatchObject({
      supplier: "mikado",
      stock_id: "w683m|7",
      order_code: "w683m",
      // The supplier's own spelling: its cart check looks the part up by it.
      brand: "MANN-FILTER",
      price: "574.75",
    });
    fireEvent.click(mikado.getByRole("button", { name: "Принять на склад" }));
    expect(onToStock).toHaveBeenCalledWith(
      // Receipts take the part as shown, like my stock lists it.
      expect.objectContaining({ key: "MANN|W683", brand: "Mann" }),
      expect.objectContaining({ stock_id: "w683m|7" }),
      "Микадо",
    );
  });
});
