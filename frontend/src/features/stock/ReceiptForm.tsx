import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";

import {
  useReceipt,
  useStockBrands,
  useStockLookup,
  useStockSuppliers,
  type StockItem,
} from "@/api/stock";
import { ApiError } from "@/api/client";
import { useSettings } from "@/api/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { formatMoney, formatPrice, trimPercent } from "./format";
import { exactPrice, parseMoney, salePrice } from "./pricing";
import { parseMarkup, usePriceFields } from "./usePriceFields";

const DEBOUNCE_MS = 300;

function cents(v: string): bigint {
  return BigInt(v.replace(".", ""));
}

function errorText(error: Error): string {
  if (
    error instanceof ApiError &&
    error.status === 422 &&
    error.message.startsWith("HTTP ")
  ) {
    return "Проверьте введённые данные";
  }
  return error.message;
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ReceiptForm({
  onAccepted,
}: {
  onAccepted: (item: StockItem) => void;
}) {
  const brandsId = useId();
  const suppliersId = useId();
  const numberRef = useRef<HTMLInputElement>(null);
  const prefilledId = useRef<number | null>(null);

  const [number, setNumber] = useState("");
  const [debounced, setDebounced] = useState("");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [cell, setCell] = useState("");
  const [supplier, setSupplier] = useState("");
  const [policy, setPolicy] = useState<"update" | "keep">("update");
  const [accepted, setAccepted] = useState<string | null>(null);
  const price = usePriceFields({ purchase: "", markup: "", sale: "" });

  const settings = useSettings();
  const defaultMarkup = settings.data
    ? trimPercent(settings.data.default_markup)
    : "";
  const lookup = useStockLookup(debounced);
  const brands = useStockBrands();
  const suppliers = useStockSuppliers();
  const receipt = useReceipt();

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(number.trim());
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
    };
  }, [number]);

  const found = lookup.data ?? [];
  const typedBrand = brand.trim().toUpperCase();
  const match: StockItem | undefined =
    found.length === 1
      ? found[0]
      : found.find((i) => i.brand.toUpperCase() === typedBrand);

  const { setAll, setMarkup } = price;
  useEffect(() => {
    if (match) {
      if (prefilledId.current === match.id) return;
      prefilledId.current = match.id;
      setBrand(match.brand);
      setName(match.name);
      setCell(match.cell ?? "");
      setAll({
        purchase: match.purchase_price,
        markup: trimPercent(match.markup),
        sale: match.sale_price,
      });
    } else if (prefilledId.current !== null) {
      prefilledId.current = null;
      setMarkup(defaultMarkup);
    }
  }, [match, defaultMarkup, setAll, setMarkup]);

  useEffect(() => {
    if (defaultMarkup !== "" && price.markup === "" && !match) {
      setMarkup(defaultMarkup);
    }
  }, [defaultMarkup, price.markup, match, setMarkup]);

  const purchase = parseMoney(price.purchase);
  const markup = parseMarkup(price.markup);
  const sale = parseMoney(price.sale);
  const qtyNum = /^\d+$/.test(qty.trim()) ? Number(qty.trim()) : 0;

  const valid =
    number.trim() !== "" &&
    brand.trim() !== "" &&
    name.trim() !== "" &&
    qtyNum > 0 &&
    purchase !== null &&
    markup !== null &&
    sale !== null;

  const priceDiffers =
    match !== undefined &&
    purchase !== null &&
    cents(purchase) !== cents(match.purchase_price);
  const newSale =
    purchase !== null && markup !== null
      ? salePrice(purchase, markup)
      : (sale ?? "");
  const showExplanation =
    purchase !== null &&
    markup !== null &&
    sale !== null &&
    cents(sale) === cents(salePrice(purchase, markup));
  const belowPurchase =
    purchase !== null && sale !== null && cents(sale) < cents(purchase);

  const brandOptions = [
    ...new Set([...found.map((i) => i.brand), ...(brands.data ?? [])]),
  ];

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!valid || receipt.isPending) return;
    setAccepted(null);
    const sentQty = qtyNum;
    receipt.mutate(
      {
        number: number.trim(),
        brand: brand.trim(),
        name: name.trim(),
        qty: sentQty,
        cell: cell.trim() || null,
        purchase_price: purchase,
        // Backend accepts only non-negative markup.
        markup: markup.startsWith("-") ? "0.00" : markup,
        sale_price: sale,
        supplier: supplier.trim() || null,
        price_policy: priceDiffers ? policy : "update",
      },
      {
        onSuccess: ({ item }) => {
          setAccepted(
            `✓ Принято: ${item.number_raw} · ${item.brand} ×${String(sentQty)} → остаток ${String(item.qty)}`,
          );
          setNumber("");
          setDebounced("");
          setBrand("");
          setName("");
          setQty("");
          setCell("");
          setPolicy("update");
          prefilledId.current = null;
          setAll({ purchase: "", markup: defaultMarkup, sale: "" });
          numberRef.current?.focus();
          onAccepted(item);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 items-end gap-2.5 min-[520px]:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        <Field label="Номер">
          <Input
            ref={numberRef}
            className="font-mono"
            autoComplete="off"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
            }}
          />
        </Field>
        <Field label="Бренд">
          <Input
            list={brandsId}
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
            }}
          />
          <datalist id={brandsId}>
            {brandOptions.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Название" className="col-span-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </Field>
        <Field label="Кол-во">
          <Input
            inputMode="numeric"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
            }}
          />
        </Field>
        <Field label="Ячейка">
          <Input
            value={cell}
            onChange={(e) => {
              setCell(e.target.value);
            }}
          />
        </Field>
        <Field label="Закупка">
          <Input
            inputMode="decimal"
            className="font-mono"
            value={price.purchase}
            onChange={(e) => {
              price.setPurchase(e.target.value);
            }}
          />
        </Field>
        <Field label="Наценка, %">
          <Input
            inputMode="decimal"
            className="font-mono"
            value={price.markup}
            onChange={(e) => {
              price.setMarkup(e.target.value);
            }}
          />
        </Field>
        <Field label="Продажа">
          <Input
            inputMode="decimal"
            className="font-mono"
            value={price.sale}
            onChange={(e) => {
              price.setSale(e.target.value);
            }}
          />
        </Field>
        <Field label="Поставщик">
          <Input
            list={suppliersId}
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
            }}
          />
          <datalist id={suppliersId}>
            {(suppliers.data ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Button
          type="submit"
          variant="primary"
          disabled={!valid || receipt.isPending}
        >
          Принять
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px]">
        {match && (
          <p className="text-muted-foreground">
            Позиция есть на складе: данные подставлены
          </p>
        )}
        {showExplanation && (
          <p className="font-mono text-muted-foreground">
            {`${formatMoney(purchase)} + ${trimPercent(markup)}% = ${formatMoney(exactPrice(purchase, markup))} → округлено до ${formatPrice(sale)} ₽`}
          </p>
        )}
        {match && priceDiffers && (
          <fieldset className="flex flex-col gap-1">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="price-policy"
                checked={policy === "update"}
                onChange={() => {
                  setPolicy("update");
                }}
              />
              {`поставить новую: ${formatMoney(purchase)} → продажа ${formatPrice(newSale)} ₽`}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="price-policy"
                checked={policy === "keep"}
                onChange={() => {
                  setPolicy("keep");
                }}
              />
              {`оставить старую: ${formatMoney(match.purchase_price)} → продажа ${formatPrice(match.sale_price)} ₽`}
            </label>
          </fieldset>
        )}
        {belowPurchase && (
          <p className="text-status-low">Цена продажи ниже закупки</p>
        )}
        {accepted && (
          <p className="rounded-lg bg-status-ok-bg px-3 py-2 font-medium text-status-ok">
            {accepted}
          </p>
        )}
        {receipt.error && (
          <p className="text-status-out">{errorText(receipt.error)}</p>
        )}
      </div>
    </form>
  );
}
