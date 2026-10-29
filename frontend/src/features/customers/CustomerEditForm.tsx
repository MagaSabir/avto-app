import { useState, type SyntheticEvent } from "react";

import {
  usePatchCustomer,
  type Customer,
  type CustomerSaved,
} from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, Field } from "@/features/stock/formBits";

import { formatPhone } from "./format";

export function CustomerEditForm({
  customer,
  onSaved,
  onCancel,
}: {
  customer: Customer;
  onSaved: (saved: CustomerSaved) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [comment, setComment] = useState(customer.comment ?? "");
  const [phones, setPhones] = useState(customer.phones.map(formatPhone));
  const patch = usePatchCustomer(customer.id);

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    const trimmedComment = comment.trim();
    patch.mutate(
      {
        name: name.trim(),
        comment: trimmedComment === "" ? null : trimmedComment,
        phones: phones.map((p) => p.trim()).filter((p) => p !== ""),
      },
      { onSuccess: onSaved },
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <Field label="Имя">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          required
        />
      </Field>
      <div className="flex flex-col gap-2">
        {phones.map((phone, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label={`Телефон ${String(i + 1)}`} className="flex-1">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhones(
                    phones.map((p, j) => (j === i ? e.target.value : p)),
                  );
                }}
                className="font-mono"
              />
            </Field>
            <Button
              aria-label="Убрать телефон"
              onClick={() => {
                setPhones(phones.filter((_, j) => j !== i));
              }}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          className="h-[34px] self-start"
          onClick={() => {
            setPhones([...phones, ""]);
          }}
        >
          + телефон
        </Button>
      </div>
      <Field label="Комментарий">
        <Input
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
          }}
        />
      </Field>
      {patch.error && (
        <p role="alert" className="text-destructive">
          {errorText(patch.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          className="h-[34px]"
          disabled={patch.isPending || name.trim() === ""}
        >
          Сохранить
        </Button>
        <Button className="h-[34px]" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
