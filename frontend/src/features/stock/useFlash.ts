import { useCallback, useEffect, useRef, useState } from "react";

export function useFlash(
  timeoutMs = 4000,
): [string | null, (message: string | null) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(
    (next: string | null) => {
      clearTimeout(timer.current);
      setMessage(next);
      if (next !== null) {
        timer.current = setTimeout(() => {
          setMessage(null);
        }, timeoutMs);
      }
    },
    [timeoutMs],
  );

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return [message, show];
}
