import { isValidPath } from "@hellotimber/phone-core";
import type { MenuNode } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { siteMenu } from "../src/content/menu";
import { allSitePaths, indexablePaths, resolveSitePath, toMenuNodes } from "../src/phone/site-tree";

const MENU_NODE_KEYS: Record<MenuNode["type"], string[]> = {
  submenu: ["type", "id", "label", "iconId", "children"],
  list: ["type", "id", "label", "items"],
  reader: ["type", "id", "label", "body"],
  app: ["type", "id", "label", "appId"],
  action: ["type", "id", "label", "action"],
};

function assertMenuNodes(nodes: MenuNode[]): void {
  for (const n of nodes) {
    const allowed = MENU_NODE_KEYS[n.type];
    for (const key of Object.keys(n)) {
      expect(allowed, `unexpected key '${key}' on node '${n.id}'`).toContain(key);
    }
    if (n.type === "submenu") assertMenuNodes(n.children);
  }
}

describe("site-tree helpers", () => {
  it("toMenuNodes strips web metadata deeply and satisfies MenuNode", () => {
    const menu = toMenuNodes(siteMenu);
    assertMenuNodes(menu);
    // phone-core accepts the result: paths resolve exactly as before
    expect(isValidPath(menu, "menu/phone-book/search")).toBe(true);
    expect(isValidPath(menu, "menu/settings/phone-settings/lights")).toBe(true);
    expect(menu.length).toBe(13);
  });

  it("resolveSitePath resolves every path allSitePaths reports", () => {
    const paths = allSitePaths(siteMenu);
    expect(paths.length).toBeGreaterThan(40); // 13 menus + their submenus
    for (const path of paths) {
      const chain = resolveSitePath(siteMenu, path);
      expect(chain, path).not.toBeNull();
      // the chain re-joins to the path it was resolved from
      expect(`/menu${chain!.map((n) => `/${n.id}`).join("")}`, path).toBe(path);
    }
  });

  it("returns null for unknown paths", () => {
    expect(resolveSitePath(siteMenu, "menu/nope")).toBeNull();
    expect(resolveSitePath(siteMenu, "menu/phone-book/nope")).toBeNull();
    expect(resolveSitePath(siteMenu, "not-menu")).toBeNull();
    expect(resolveSitePath(siteMenu, "")).toBeNull();
  });

  it("'/menu' (and 'menu') resolve to the empty chain — the carousel", () => {
    expect(resolveSitePath(siteMenu, "/menu")).toEqual([]);
    expect(resolveSitePath(siteMenu, "menu")).toEqual([]);
  });

  it("indexablePaths ⊆ allSitePaths, includes /menu, excludes noindex + undescribed", () => {
    const all = new Set(allSitePaths(siteMenu));
    const indexable = indexablePaths(siteMenu);
    for (const p of indexable) expect(all.has(p), p).toBe(true);
    expect(indexable).toContain("/menu");
    expect(indexable).toContain("/menu/phone-book");
    expect(indexable).toContain("/menu/games/snake");
    expect(indexable).not.toContain("/menu/sim-services"); // noindex easter egg
    expect(indexable).not.toContain("/menu/phone-book/search"); // no description
  });
});
