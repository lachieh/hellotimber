/**
 * URL ⇄ phone path mapping (VISION: URL = '/' + phone path).
 * Shape-level only — tree-level validity is phone-core's job
 * (phone.navigate() falls back to 'standby' for unknown paths).
 */

/** 'menu' optionally followed by kebab-case id segments. */
const PHONE_PATH_RE = /^menu(?:\/[a-z0-9-]+)*$/;

/** Browser pathname → phone path. '/' → 'standby'; unknown shapes → 'standby'. */
export function phonePathFromUrl(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return "standby";
  const path = trimmed.replace(/^\/+/, "");
  return PHONE_PATH_RE.test(path) ? path : "standby";
}

/** Phone path → browser pathname. 'standby' → '/'. */
export function urlFromPhonePath(path: string): string {
  return path === "standby" ? "/" : `/${path}`;
}
