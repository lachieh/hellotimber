import { SubmenuEntry } from "./menu";
import type { MenuEntry, PhoneMenu } from "./menu";

/** Trim whitespace and leading/trailing slashes; empty → 'standby'. */
export function normalizePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "standby" : trimmed;
}

export type ParsedPath = { kind: "standby" } | { kind: "menu"; ids: string[] };

/**
 * Parse 'standby' | 'menu' | 'menu/<id>/…'.
 * Returns null for anything outside the path scheme.
 */
export function parsePath(path: string): ParsedPath | null {
  const p = normalizePath(path);
  if (p === "standby") return { kind: "standby" };
  const segments = p.split("/");
  if (segments[0] !== "menu") return null;
  const ids = segments.slice(1);
  if (ids.some((id) => id === "")) return null;
  return { kind: "menu", ids };
}

/** The entries a path segment can descend into — only submenus nest. */
export function childrenOf<Metadata>(entry: MenuEntry<Metadata>): readonly MenuEntry<Metadata>[] {
  return entry instanceof SubmenuEntry ? entry.children.entries : [];
}

/**
 * Resolve menu ids to the nodes along the path (one node per id).
 * Returns null if any segment is unknown.
 */
export function resolveIds<Metadata>(
  menu: PhoneMenu<Metadata>,
  ids: readonly string[],
): readonly MenuEntry<Metadata>[] | null {
  return menu.resolve(joinMenuPath(ids));
}

/** True when the path is 'standby', 'menu', or resolves fully in the tree. */
export function isValidPath<Metadata>(menu: PhoneMenu<Metadata>, path: string): boolean {
  return menu.isValidPath(path);
}

/** Join node ids back into a path string ('menu' when empty). */
export function joinMenuPath(ids: readonly string[]): string {
  return ids.length === 0 ? "menu" : `menu/${ids.join("/")}`;
}
