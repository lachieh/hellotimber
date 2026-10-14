import type { MenuEntry, MenuEntryVisitor } from "@hellotimber/phone-core";
import { siteMenu } from "../content/menu";
import type { PanelId, WebMetadata } from "../content/types";

export interface SiteRouteProjection {
  title: string;
  description: string | null;
  indexing: "index" | "noindex";
  panel: PanelId | null;
  slugChain: string[];
}

type EntryProjection = Omit<SiteRouteProjection, "slugChain">;

function projectEntryMetadata(entry: MenuEntry<WebMetadata>): EntryProjection {
  return {
    title: entry.label,
    description: entry.metadata?.description ?? null,
    indexing: entry.metadata?.indexing ?? "noindex",
    panel: entry.metadata?.panel ?? null,
  };
}

const routeMetadataVisitor = {
  visitSubmenu: projectEntryMetadata,
  visitList: projectEntryMetadata,
  visitReader: projectEntryMetadata,
  visitAction: projectEntryMetadata,
  visitApplication: projectEntryMetadata,
} satisfies MenuEntryVisitor<WebMetadata, EntryProjection>;

/** Resolve a phone path to loader-safe data. No menu or application objects cross the route seam. */
export function projectSiteRoute(path: string): SiteRouteProjection | null {
  const chain = siteMenu.resolve(path);
  if (chain === null) return null;

  const entry = chain.at(-1);
  if (entry === undefined) {
    return {
      title: "Menu",
      description: "Browse the phone menu.",
      indexing: "index",
      panel: null,
      slugChain: [],
    };
  }

  return {
    ...entry.accept(routeMetadataVisitor),
    slugChain: chain.map((ancestor) => ancestor.slug.value),
  };
}

/** Every valid menu URL in the aggregate's canonical order. */
export function allSitePaths(): string[] {
  return siteMenu.paths().map((path) => `/${path}`);
}

/** Canonical menu URLs whose leaf metadata explicitly permits indexing. */
export function indexablePaths(): string[] {
  return siteMenu.paths().flatMap((path) => {
    const projection = projectSiteRoute(path);
    return projection?.indexing === "index" ? [`/${path}`] : [];
  });
}
