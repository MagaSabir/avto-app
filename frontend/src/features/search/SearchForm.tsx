import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  initial: string;
  onSearch: (q: string) => void;
};

// Mirrors the backend number normalization closely enough to reject blanks.
function isBlank(v: string): boolean {
  return (v.split("@")[0] ?? "").replace(/[\s\-./]/g, "") === "";
}

export function SearchForm({ initial, onSearch }: Props) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (isBlank(q)) {
          setError(true);
          return;
        }
        setError(false);
        onSearch(q);
      }}
      className="flex flex-col gap-1"
    >
      <label htmlFor={id} className="text-[12px] text-muted-foreground">
        OEM-номер или артикул
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          autoComplete="off"
          spellCheck={false}
          className="font-mono md:max-w-md"
        />
        <Button type="submit" variant="primary">
          Найти
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-status-out">
          Введите номер
        </p>
      )}
    </form>
  );
}
