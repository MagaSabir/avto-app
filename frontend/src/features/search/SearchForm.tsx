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
      <div className="flex max-w-[940px] gap-2">
        <div
          className={`flex h-[50px] min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-border-active bg-card px-[13px] focus-within:ring-[3px] focus-within:ring-ring ${
            error ? "border-destructive!" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <label htmlFor={id} className="text-[13px] text-muted-foreground">
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
              className="w-full bg-transparent text-[15px] font-semibold outline-none"
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
          <Search
            size={20}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="h-[50px] rounded-[10px] border-primary-foreground/20 px-[30px] text-[15px] font-[650]"
        >
          Найти
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          Введите номер
        </p>
      )}
    </form>
  );
}
