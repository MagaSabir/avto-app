import { useState, type SyntheticEvent } from "react";

import { useCreateCustomer, type CustomerSaved } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { errorText, Field } from "@/features/stock/formBits";

function NewCustomerForm({
  compact,
  onClose,
  onCreated,
}: {
  compact: boolean;
  onClose: () => void;
  onCreated: (customer: CustomerSaved) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const create = useCreateCustomer();

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    // Portals bubble React events: never let a host form see this submit.
    e.stopPropagation();
    const trimmedPhone = phone.trim();
    const trimmedComment = comment.trim();
    create.mutate(
      {
        name: name.trim(),
        comment: trimmedComment === "" ? null : trimmedComment,
        phones: trimmedPhone === "" ? [] : [trimmedPhone],
      },
      { onSuccess: onCreated },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <Field label="Имя">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          required
          autoFocus
        />
      </Field>
      <Field label="Телефон">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
          }}
          className="font-mono"
        />
      </Field>
      {!compact && (
        <Field label="Комментарий">
          <Input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
            }}
          />
        </Field>
      )}
      {create.error && (
        <p role="alert" className="text-destructive">
          {errorText(create.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          className="h-[34px]"
          disabled={create.isPending || name.trim() === ""}
        >
          Создать
        </Button>
        <Button type="button" className="h-[34px]" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

export function NewCustomerDialog({
  open,
  onClose,
  onCreated,
  compact = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: CustomerSaved) => void;
  compact?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый клиент"
      className="max-w-[420px]"
    >
      {open && (
        <NewCustomerForm
          compact={compact}
          onClose={onClose}
          onCreated={onCreated}
        />
      )}
    </Modal>
  );
}
