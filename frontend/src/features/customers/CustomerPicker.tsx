import { useEffect, useId, useState, type KeyboardEvent } from "react";

import {
  useCustomers,
  type CustomerBrief,
  type CustomerSaved,
} from "@/api/customers";
import { Input } from "@/components/ui/input";

import { carLabel, formatPhone } from "./format";
import { NewCustomerDialog } from "./NewCustomerDialog";

export type PickerValue = {
  customer: CustomerBrief | null;
  carId: number | null;
};

const MIN_CHARS = 2;
const MAX_ROWS = 8;

function optionText(c: CustomerBrief): string {
  const phone = c.phones.length > 0 ? formatPhone(c.phones[0]) : "";
  const plate = c.cars.length > 0 ? (c.cars[0].plate ?? "") : "";
  return [c.name, phone, plate].filter((p) => p !== "").join(" · ");
}

function pick(customer: CustomerBrief): PickerValue {
  return {
    customer,
    carId: customer.cars.length === 1 ? customer.cars[0].id : null,
  };
}

export function CustomerPicker({
  value,
  onChange,
}: {
  value: PickerValue;
  onChange: (value: PickerValue) => void;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
    }, 300);
    return () => {
      clearTimeout(id);
    };
  }, [text]);

  const { data } = useCustomers(q, q.length >= MIN_CHARS);
  const options =
    value.customer === null && text.trim().length >= MIN_CHARS
      ? (data ?? []).slice(0, MAX_ROWS)
      : [];
  const expanded = open && options.length > 0;

  function choose(customer: CustomerBrief) {
    setText(customer.name);
    setOpen(false);
    setActive(-1);
    onChange(pick(customer));
  }

  function clear() {
    setText("");
    setQ("");
    setOpen(false);
    setActive(-1);
    onChange({ customer: null, carId: null });
  }

  function created(saved: CustomerSaved) {
    setCreating(false);
    choose({
      id: saved.id,
      name: saved.name,
      phones: saved.phones,
      cars: saved.cars.map((c) => ({
        id: c.id,
        make: c.make,
        model: c.model,
        plate: c.plate,
      })),
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + options.length) % options.length);
    } else if (e.key === "Enter" && expanded) {
      if (active >= 0 && active < options.length) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === "Escape" && expanded) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  const cars = value.customer?.cars ?? [];
  return (
    <div className="relative col-span-2 flex flex-col gap-1">
      <label
        htmlFor={`${uid}-input`}
        className="text-[12.5px] text-muted-foreground"
      >
        Клиент
      </label>
      <div className="relative">
        <Input
          id={`${uid}-input`}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            expanded && active >= 0 ? `${uid}-opt-${String(active)}` : undefined
          }
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
            if (value.customer !== null)
              onChange({ customer: null, carId: null });
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
          }}
          className="pr-8"
        />
        {text !== "" && (
          <button
            type="button"
            aria-label="Очистить клиента"
            onClick={clear}
            className="absolute inset-y-0 right-2 text-muted-foreground"
          >
            ×
          </button>
        )}
        {expanded && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Клиенты"
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-md"
          >
            {options.map((c, i) => (
              <li
                key={c.id}
                id={`${uid}-opt-${String(i)}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  choose(c);
                }}
                className={`cursor-pointer px-3 py-1.5 text-[13px] ${i === active ? "bg-accent" : ""}`}
              >
                {optionText(c)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {cars.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] text-muted-foreground">Машина</span>
          <select
            className="h-[38px] w-full rounded-lg border bg-input px-3"
            value={value.carId === null ? "" : String(value.carId)}
            onChange={(e) => {
              onChange({
                customer: value.customer,
                carId: e.target.value === "" ? null : Number(e.target.value),
              });
            }}
          >
            <option value="">Без машины</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {carLabel(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          setCreating(true);
        }}
        className="self-start text-[12.5px] text-primary hover:underline"
      >
        + Новый клиент
      </button>
      <NewCustomerDialog
        compact
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        onCreated={created}
      />
    </div>
  );
}
