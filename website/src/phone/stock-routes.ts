import { stockMenuFor } from "@hellotimber/nokia-os";
import { PORTFOLIO_SIM } from "../content/sim";
import { ROUTE_CONTENT, REDIRECTS } from "../content/routes";
export const portfolioMenu = stockMenuFor(PORTFOLIO_SIM);
export interface StockRouteProjection {
  title: string;
  description: string | null;
  indexing: "index" | "noindex";
  panel: string;
  slugChain: string[];
}
export function projectStockRoute(path: string): StockRouteProjection | null {
  const canonical = path.replace(/^\/+|\/+$/g, "");
  const chain = portfolioMenu.resolve(canonical);
  if (chain === null) return null;
  const content = ROUTE_CONTENT[`/${canonical}`];
  return {
    title: (chain.at(-1)?.label ?? "Menu").replace(/\s+/g, " ").trim(),
    description: content?.description ?? null,
    indexing: content ? "index" : "noindex",
    panel: content?.panel ?? "generic",
    slugChain: chain.map((entry) => entry.slug.value),
  };
}
export function indexablePaths(): string[] {
  return portfolioMenu
    .paths()
    .filter((path) => ROUTE_CONTENT[`/${path}`] !== undefined)
    .map((path) => `/${path}`);
}
export function redirectFor(path: string): string | null {
  return Object.hasOwn(REDIRECTS, path) ? REDIRECTS[path]! : null;
}
export function stockSitemapPaths(): string[] {
  return ["/", ...indexablePaths()];
}
