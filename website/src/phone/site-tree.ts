import type { MenuNode } from "@hellotimber/phone-core";
import type { SiteNode } from "../content/types";

/**
 * Helpers over the SiteNode tree (plan 07). The tree is the single source of
 * truth: the phone's menus, the URL space, and the sitemap all derive from it.
 */

/** Strip web metadata → the phone's MenuNode[] (deep). */
export function toMenuNodes(nodes: SiteNode[]): MenuNode[] {
  return nodes.map((n): MenuNode => {
    if (n.type === "submenu") {
      const { web: _web, children, ...rest } = n;
      return { ...rest, children: toMenuNodes(children) };
    }
    const { web: _web, ...rest } = n;
    return rest;
  });
}

function childrenOf(node: SiteNode): SiteNode[] {
  return node.type === "submenu" ? node.children : [];
}

/** Resolve "menu/a/b" (or "/menu/a/b") → the SiteNode chain, or null. */
export function resolveSitePath(nodes: SiteNode[], path: string): SiteNode[] | null {
  const segments = path.split("/").filter((s) => s !== "");
  if (segments[0] !== "menu") return null;
  const chain: SiteNode[] = [];
  let level = nodes;
  for (const id of segments.slice(1)) {
    const node = level.find((n) => n.id === id);
    if (node === undefined) return null;
    chain.push(node);
    level = childrenOf(node);
  }
  return chain; // [] ⇒ the "/menu" carousel itself
}

/** Every valid URL pathname ("/menu", "/menu/a", "/menu/a/b", …). */
export function allSitePaths(nodes: SiteNode[]): string[] {
  const paths: string[] = ["/menu"];
  const walk = (level: SiteNode[], prefix: string): void => {
    for (const n of level) {
      const path = `${prefix}/${n.id}`;
      paths.push(path);
      walk(childrenOf(n), path);
    }
  };
  walk(nodes, "/menu");
  return paths;
}

/**
 * allSitePaths filtered to indexable nodes (web.description && !web.noindex).
 * "/menu" (the carousel — no node of its own) is always indexable.
 */
export function indexablePaths(nodes: SiteNode[]): string[] {
  return allSitePaths(nodes).filter((path) => {
    const chain = resolveSitePath(nodes, path);
    if (chain === null) return false;
    const node = chain.at(-1);
    if (node === undefined) return true; // "/menu" itself
    return typeof node.web?.description === "string" && node.web.noindex !== true;
  });
}
