// The last search (`?q=…&part=…`) of this tab, so the "Поиск" link can
// bring it back after the stock screen. Storage may be blocked: then the
// value lives in memory only.
const KEY = "avto.lastSearch";
let memory = "";

// Memory first: a failed storage write must not bring back an older value.
export function getLastSearch(): string {
  if (memory !== "") return memory;
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setLastSearch(search: string): void {
  memory = search;
  try {
    if (search === "") sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, search);
  } catch {
    // Memory already holds it.
  }
}
