const DEFAULT_NEXT = "/stock";

// Only same-origin paths are allowed as a post-login target.
export function safeNext(raw: string | null): string {
  if (
    raw === null ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\") ||
    /^\/login(?![\w-])/.test(raw)
  )
    return DEFAULT_NEXT;
  return raw;
}
