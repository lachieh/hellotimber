import type { MenuNode } from "./types";

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

/** The nodes a path segment can descend into — only submenus nest. */
export function childrenOf(node: MenuNode): MenuNode[] {
  return node.type === "submenu" ? node.children : [];
}

/**
 * Resolve menu ids to the nodes along the path (one node per id).
 * Returns null if any segment is unknown.
 */
export function resolveIds(menu: MenuNode[], ids: string[]): MenuNode[] | null {
  const nodes: MenuNode[] = [];
  let level: MenuNode[] = menu;
  for (const id of ids) {
    const node = level.find((n) => n.id === id);
    if (node === undefined) return null;
    nodes.push(node);
    level = childrenOf(node);
  }
  return nodes;
}

/** True when the path is 'standby', 'menu', or resolves fully in the tree. */
export function isValidPath(menu: MenuNode[], path: string): boolean {
  const parsed = parsePath(path);
  if (parsed === null) return false;
  if (parsed.kind === "standby") return true;
  return resolveIds(menu, parsed.ids) !== null;
}

/** Join node ids back into a path string ('menu' when empty). */
export function joinMenuPath(ids: string[]): string {
  return ids.length === 0 ? "menu" : `menu/${ids.join("/")}`;
}
