import { useId, useState, type ReactNode, type SyntheticEvent } from "react";

import {
  useAdjustment,
  usePatchItem,
  useReturn,
  useSale,
  useWriteoff,
  type StockItemDetail,
  type StockItemPatch,
} from "@/api/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cents, errorText, Field } from "./formBits";
import { formatPrice, trimPercent } from "./format";
import {
  markupFromSale,
  markupTooLarge,
  parseMarkup,
  parseMoney,
} from "./pricing";
import { useFlash } from "./useFlash";
import { usePriceFields } from "./usePriceFields";

type Mode = "sale" | "return" | "writeoff" | "adjustment" | "edit";

const BUTTONS: { mode: Mode; label: string }[] = [
  { mode: "sale", label: "Продать" },
  { mode: "return", label: "Возврат" },
  { mode: "writeoff", label: "Списать" },
  { mode: "adjustment", label: "Корректировка" },
  { mode: "edit", label: "Изменить" },
];

const REASONS = ["брак", "потеря"];

type FormProps = {
  item: StockItemDetail;
  onCancel: () => void;
  onDone: (message: string) => void;
};

function parseQty(v: string, min: number): number | null {
  const t = v.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min ? n : null;
}

function FormShell({
  submitLabel,
  canSubmit,
  pending,
  error,
  warning,
  tooLarge,
  onSubmit,
  onCancel,
  children,
}: {
  submitLabel: string;
  canSubmit: boolean;
  pending: boolean;
  error: Error | null;
  warning?: boolean;
  tooLarge?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (canSubmit && !pending) onSubmit();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
      {warning && <p className="text-status-low">Цена продажи ниже закупки</p>}
      {tooLarge && (
        <p className="text-status-out">
          Наценка слишком большая — проверьте закупку
        </p>
      )}
      {error && <p className="text-status-out">{errorText(error)}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          className="h-[34px]"
          disabled={!canSubmit || pending}
        >
          {submitLabel}
        </Button>
        <Button className="h-[34px]" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function SaleReturnForm({
  kind,
  item,
  onCancel,
  onDone,
}: FormProps & { kind: "sale" | "return" }) {
  const sale = useSale(item.id);
  const ret = useReturn(item.id);
  const op = kind === "sale" ? sale : ret;
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState(formatPrice(item.sale_price));

  const qtyNum = parseQty(qty, 1);
  const priceNum = parseMoney(price);
  const below =
    kind === "sale" &&
    priceNum !== null &&
    cents(priceNum) < cents(item.purchase_price);

  return (
    <FormShell
      submitLabel="Провести"
      canSubmit={qtyNum !== null && priceNum !== null}
      pending={op.isPending}
      error={op.error}
      warning={below}
      onCancel={onCancel}
      onSubmit={() => {
        if (qtyNum === null || priceNum === null) return;
        op.mutate(
          { qty: qtyNum, price: priceNum },
          {
            onSuccess: ({ item: next }) => {
              onDone(
                kind === "sale"
                  ? `✓ Продажа: −${String(qtyNum)} → остаток ${String(next.qty)}`
                  : `✓ Возврат: +${String(qtyNum)} → остаток ${String(next.qty)}`,
              );
            },
          },
        );
      }}
    >
      <Field label="Кол-во">
        <Input
          inputMode="numeric"
          autoFocus
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
          }}
        />
      </Field>
      <Field label="Цена">
        <Input
          inputMode="decimal"
          className="font-mono"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
          }}
        />
      </Field>
    </FormShell>
  );
}

function WriteoffForm({ item, onCancel, onDone }: FormProps) {
  const op = useWriteoff(item.id);
  const listId = useId();
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  const qtyNum = parseQty(qty, 1);
  return (
    <FormShell
      submitLabel="Провести"
      canSubmit={qtyNum !== null && reason.trim() !== ""}
      pending={op.isPending}
      error={op.error}
      onCancel={onCancel}
      onSubmit={() => {
        if (qtyNum === null) return;
        op.mutate(
          { qty: qtyNum, comment: reason.trim() },
          {
            onSuccess: ({ item: next }) => {
              onDone(
                `✓ Списание: −${String(qtyNum)} → остаток ${String(next.qty)}`,
              );
            },
          },
        );
      }}
    >
      <Field label="Кол-во">
        <Input
          inputMode="numeric"
          autoFocus
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
          }}
        />
      </Field>
      <Field label="Причина">
        <Input
          list={listId}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
        />
        <datalist id={listId}>
          {REASONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Field>
    </FormShell>
  );
}

function AdjustmentForm({ item, onCancel, onDone }: FormProps) {
  const op = useAdjustment(item.id);
  const [actual, setActual] = useState(String(item.qty));
  const [comment, setComment] = useState("");

  const actualNum = parseQty(actual, 0);
  return (
    <FormShell
      submitLabel="Провести"
      canSubmit={actualNum !== null}
      pending={op.isPending}
      error={op.error}
      onCancel={onCancel}
      onSubmit={() => {
        if (actualNum === null) return;
        op.mutate(
          {
            actual_qty: actualNum,
            ...(comment.trim() ? { comment: comment.trim() } : {}),
          },
          {
            onSuccess: ({ item: next }) => {
              onDone(
                `✓ Корректировка: ${String(item.qty)} → остаток ${String(next.qty)}`,
              );
            },
          },
        );
      }}
    >
      <Field label="Фактическое кол-во">
        <Input
          inputMode="numeric"
          autoFocus
          value={actual}
          onChange={(e) => {
            setActual(e.target.value);
          }}
        />
      </Field>
      <Field label="Комментарий">
        <Input
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
          }}
        />
      </Field>
    </FormShell>
  );
}

function EditForm({ item, onCancel, onDone }: FormProps) {
  const op = usePatchItem(item.id);
  const [name, setName] = useState(item.name);
  const [cell, setCell] = useState(item.cell ?? "");
  const [minQty, setMinQty] = useState(String(item.min_qty));
  const price = usePriceFields({
    purchase: item.purchase_price,
    markup: trimPercent(item.markup),
    sale: item.sale_price,
  });

  const minNum = parseQty(minQty, 0);
  const purchase = parseMoney(price.purchase);
  const markup = parseMarkup(price.markup);
  const sale = parseMoney(price.sale);

  const patch: StockItemPatch = {};
  if (name.trim() !== item.name) patch.name = name.trim();
  if (cell.trim() !== (item.cell ?? "")) patch.cell = cell.trim() || null;
  if (minNum !== null && minNum !== item.min_qty) patch.min_qty = minNum;
  if (purchase !== null && purchase !== item.purchase_price)
    patch.purchase_price = purchase;
  if (markup !== null && markup !== item.markup) patch.markup = markup;
  if (sale !== null && sale !== item.sale_price) patch.sale_price = sale;

  const valid =
    name.trim() !== "" &&
    minNum !== null &&
    purchase !== null &&
    markup !== null &&
    sale !== null &&
    Object.keys(patch).length > 0;
  const below =
    purchase !== null && sale !== null && cents(sale) < cents(purchase);
  const tooLarge =
    purchase !== null &&
    sale !== null &&
    markupTooLarge(markupFromSale(purchase, sale));

  return (
    <FormShell
      submitLabel="Сохранить"
      canSubmit={valid}
      pending={op.isPending}
      error={op.error}
      warning={below}
      tooLarge={tooLarge}
      onCancel={onCancel}
      onSubmit={() => {
        op.mutate(patch, {
          onSuccess: () => {
            onDone("✓ Сохранено");
          },
        });
      }}
    >
      <Field label="Название" className="col-span-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
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
      <Field label="Мин. остаток">
        <Input
          inputMode="numeric"
          value={minQty}
          onChange={(e) => {
            setMinQty(e.target.value);
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
    </FormShell>
  );
}

export function ItemActions({ item }: { item: StockItemDetail }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [done, setDone] = useFlash();

  const cancel = () => {
    setMode(null);
  };
  const finish = (message: string) => {
    setDone(message);
    setMode(null);
  };
  const props: FormProps = { item, onCancel: cancel, onDone: finish };

  return (
    <div className="flex flex-col gap-2.5">
      {done && mode === null && (
        <p className="rounded-lg bg-status-ok-bg px-3 py-2 text-[13px] font-medium text-status-ok">
          {done}
        </p>
      )}
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          {BUTTONS.map(({ mode: m, label }) => (
            <Button
              key={m}
              variant={m === "sale" ? "primary" : "default"}
              className="h-[34px]"
              onClick={() => {
                setDone(null);
                setMode(m);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      {(mode === "sale" || mode === "return") && (
        <SaleReturnForm key={mode} kind={mode} {...props} />
      )}
      {mode === "writeoff" && <WriteoffForm {...props} />}
      {mode === "adjustment" && <AdjustmentForm {...props} />}
      {mode === "edit" && <EditForm {...props} />}
    </div>
  );
}
