import { useRef, useState } from "react";

import { useSetCartQty, type CartItem } from "@/api/cart";
import { Input } from "@/components/ui/input";

export function CartQtyField({ item }: { item: CartItem }) {
  const [value, setValue] = useState(String(item.qty));
  const sent = useRef(item.qty);
  const setQty = useSetCartQty();

  const qty = Number(value);
  const valid =
    /^\d+$/.test(value) &&
    qty > 0 &&
    qty % item.multiplicity === 0 &&
    qty <= item.available;

  function commit() {
    if (!valid || qty === sent.current) return;
    const previous = sent.current;
    sent.current = qty;
    setQty.mutate(
      { id: item.id, qty },
      {
        onError: () => {
          sent.current = previous;
        },
      },
    );
  }

  const showInvalid = !valid && value !== String(item.qty);
  return (
    <div className="w-20">
      <Input
        inputMode="numeric"
        aria-label={`Количество ${item.number}`}
        aria-invalid={showInvalid}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        onBlur={commit}
        className="text-right tabular-nums aria-invalid:border-destructive"
      />
      {showInvalid && (
        <p className="mt-0.5 text-[12px] text-destructive">
          {`кратно ${String(item.multiplicity)}, не больше ${String(item.available)}`}
        </p>
      )}
      {setQty.isError && (
        <p className="mt-0.5 text-[12px] text-destructive">
          {setQty.error.message}
        </p>
      )}
    </div>
  );
}
