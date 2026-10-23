import {
  useEffect,
  useId,
  useRef,
  useState,
  type Ref,
  type SyntheticEvent,
} from "react";

import {
  useReceipt,
  useStockBrands,
  useStockLookup,
  useStockSuppliers,
  type StockItem,
} from "@/api/stock";
import { useSettings } from "@/api/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normBrand } from "@/lib/brand";

import { cents, errorText, Field } from "./formBits";
import { formatMoney, formatPrice, trimPercent } from "./format";
import {
  exactPrice,
  markupFromSale,
  markupTooLarge,
  parseMarkup,
  parseMoney,
  salePrice,
} from "./pricing";
import { useFlash } from "./useFlash";
import { usePriceFields } from "./usePriceFields";

const DEBOUNCE_MS = 300;

export type ReceiptPrefill = {
  number: string;
  brand: string;
  name: string;
  purchase: string;
  supplier: string;
};

export function ReceiptForm({
  onAccepted,
  prefill,
  layout = "row",
  qtyRef,
}: {
  onAccepted: (item: StockItem) => void;
  // Starting values (an offer taken from search): the purchase price stays
  // the offer's even when the stock item has another one.
  prefill?: ReceiptPrefill;
  layout?: "row" | "column";
  qtyRef?: Ref<HTMLInputElement>;
}) {
  const brandsId = useId();
  const suppliersId = useId();
  const numberRef = useRef<HTMLInputElement>(null);
  const prefilledId = useRef<number | null>(null);

  const [number, setNumber] = useState(prefill?.number ?? "");
  const [debounced, setDebounced] = useState(prefill?.number.trim() ?? "");
  const [brand, setBrand] = useState(prefill?.brand ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [qty, setQty] = useState("");
  const [cell, setCell] = useState("");
  const [supplier, setSupplier] = useState(prefill?.supplier ?? "");
  const [policy, setPolicy] = useState<"update" | "keep">("update");
  // The debounced number the last prefill came from; reset once the number
  // changes, so an emptied brand is auto-filled only for a new number.
  const [prefillNumber, setPrefillNumber] = useState<string | null>(null);
  const [accepted, setAccepted] = useFlash();
  const price = usePriceFields({
    purchase: prefill?.purchase ?? "",
    markup: "",
    sale: "",
  });

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
      const next = number.trim();
      setDebounced(next);
      setPrefillNumber((p) => (p === next ? p : null));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
    };
  }, [number]);

  const found = lookup.data ?? [];
  const typedBrand = normBrand(brand);
  const match: StockItem | undefined = found.find(
    (i) => normBrand(i.brand) === typedBrand,
  );
  // An empty brand field with a single lookup result is prefilled too,
  // unless the user emptied it after a prefill for this same number.
  const numberChanged = prefillNumber !== debounced;
  const autoFill = typedBrand === "" && found.length === 1 && numberChanged;
  const target: StockItem | undefined =
    match ?? (autoFill ? found[0] : undefined);

  const { setAll, setMarkup } = price;
  useEffect(() => {
    if (target) {
      if (prefilledId.current === target.id) return;
      prefilledId.current = target.id;
      setPrefillNumber(debounced);
      setBrand(target.brand);
      setName(target.name);
      setCell(target.cell ?? "");
      const markup = trimPercent(target.markup);
      const offered = prefill ? parseMoney(prefill.purchase) : null;
      const offeredMarkup = parseMarkup(markup);
      setAll(
        prefill && offered !== null && offeredMarkup !== null
          ? {
              purchase: prefill.purchase,
              markup,
              sale: salePrice(offered, offeredMarkup),
            }
          : {
              purchase: target.purchase_price,
              markup,
              sale: target.sale_price,
            },
      );
    } else if (prefilledId.current !== null) {
      // The prefilled item no longer matches: drop its data. A brand the
      // user is editing for the same number is kept.
      prefilledId.current = null;
      setBrand((b) => (numberChanged ? "" : b));
      setName("");
      setCell("");
      setPolicy("update");
      setAll({ purchase: "", markup: defaultMarkup, sale: "" });
    }
  }, [target, debounced, numberChanged, defaultMarkup, setAll, prefill]);

  // Default markup is applied once, when settings first arrive.
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (defaultMarkup === "" || defaultApplied.current) return;
    defaultApplied.current = true;
    if (price.markup === "" && !prefilledId.current) setMarkup(defaultMarkup);
  }, [defaultMarkup, price.markup, setMarkup]);

  const purchase = parseMoney(price.purchase);
  const markup = parseMarkup(price.markup);
  const sale = parseMoney(price.sale);
  const qtyNum = /^\d+$/.test(qty.trim()) ? Number(qty.trim()) : 0;
  const tooLarge =
    purchase !== null &&
    sale !== null &&
    markupTooLarge(markupFromSale(purchase, sale));

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
        markup,
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
          setPrefillNumber(null);
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
      <div
        className={
          layout === "column"
            ? "grid grid-cols-2 items-end gap-2.5"
            : "grid grid-cols-2 items-end gap-2.5 min-[520px]:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
        }
      >
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
            ref={qtyRef}
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
          className={layout === "column" ? "col-span-2" : undefined}
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
        {tooLarge && (
          <p className="text-status-out">
            Наценка слишком большая — проверьте закупку
          </p>
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
