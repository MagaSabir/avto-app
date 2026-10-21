// The last search (`?q=…&part=…`) of this tab, so the "Поиск" link can
// bring it back after the stock screen. Storage may be blocked: then the
// value lives in memory only.
const KEY = "avto.lastSearch";
let memory = "";

export function getLastSearch(): string {
  try {
    return sessionStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
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
