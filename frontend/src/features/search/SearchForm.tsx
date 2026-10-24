import { Search, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

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
  const inputRef = useRef<HTMLInputElement>(null);
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
      <div className="flex gap-2">
        <div
          className={`flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-lg border bg-input px-3.5 focus-within:ring-[3px] focus-within:ring-ring md:max-w-xl ${
            error ? "border-status-out" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <label htmlFor={id} className="text-[12px] text-muted-foreground">
              OEM/Номер или артикул
            </label>
            <input
              ref={inputRef}
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
              className="w-full bg-transparent font-mono text-[15px] outline-none"
            />
          </div>
          {value !== "" && (
            <button
              type="button"
              aria-label="Очистить"
              onClick={() => {
                setValue("");
                setError(false);
                inputRef.current?.focus();
              }}
              className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-selected hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          className="inline-flex h-[52px] items-center gap-2 px-6"
        >
          <Search size={16} aria-hidden="true" />
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
