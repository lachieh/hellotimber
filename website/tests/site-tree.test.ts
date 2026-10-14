import { describe, expect, it } from "vite-plus/test";
import { siteMenu } from "../src/content/menu";
import { allSitePaths, indexablePaths, projectSiteRoute } from "../src/phone/site-tree";

describe("site-tree helpers", () => {
  it("projects every PhoneMenu path without reimplementing traversal", () => {
    const paths = allSitePaths();
    expect(paths.length).toBeGreaterThan(40); // 13 menus + their submenus
    for (const path of paths) {
      const projection = projectSiteRoute(path);
      expect(projection, path).not.toBeNull();
      expect(`/menu${projection!.slugChain.map((slug) => `/${slug}`).join("")}`, path).toBe(path);
    }
    expect(paths).toEqual(siteMenu.paths().map((path) => `/${path}`));
  });

  it("returns null for unknown paths so the dynamic route can issue a real 404", () => {
    expect(projectSiteRoute("menu/nope")).toBeNull();
    expect(projectSiteRoute("menu/phone-book/nope")).toBeNull();
    expect(projectSiteRoute("not-menu")).toBeNull();
    expect(projectSiteRoute("")).toBeNull();
  });

  it("preserves the special indexable /menu carousel projection", () => {
    expect(projectSiteRoute("/menu")).toEqual({
      title: "Menu",
      description: "Browse the phone menu.",
      indexing: "index",
      panel: null,
      slugChain: [],
    });
    expect(projectSiteRoute("menu")).toEqual(projectSiteRoute("/menu"));
  });

  it("projects only plain serializable loader data", () => {
    for (const path of siteMenu.paths()) {
      const projection = projectSiteRoute(path);
      expect(projection, path).not.toBeNull();
      expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
      expect(Object.getPrototypeOf(projection!)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(projection!.slugChain)).toBe(Array.prototype);
    }
  });

  it("indexablePaths is a canonical subset and excludes noindex and undescribed entries", () => {
    const all = new Set(allSitePaths());
    const indexable = indexablePaths();
    for (const p of indexable) expect(all.has(p), p).toBe(true);
    expect(indexable).toContain("/menu");
    expect(indexable).toContain("/menu/phone-book");
    expect(indexable).toContain("/menu/games/snake");
    expect(indexable).not.toContain("/menu/sim-services"); // noindex easter egg
    expect(indexable).not.toContain("/menu/phone-book/search"); // no description
  });

  it("preserves SIM services as a valid noindex route projection", () => {
    expect(projectSiteRoute("menu/sim-services")).toEqual({
      title: "SIM services",
      description: "No service.",
      indexing: "noindex",
      panel: "sim-services",
      slugChain: ["sim-services"],
    });
  });
});
