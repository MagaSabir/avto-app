// The last successfully used login, to prefill the sign-in form. Storage may
// be blocked: then nothing is remembered.
const KEY = "lastLogin";

export function getLastLogin(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setLastLogin(login: string): void {
  try {
    localStorage.setItem(KEY, login);
  } catch {
    // Not remembered.
  }
}
