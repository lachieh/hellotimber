import { describe, expect, it } from "vite-plus/test";
import { pageHead, personJsonLd, SITEMAP_PATHS } from "../src/seo";

describe("seo", () => {
  it("builds a titled head with description meta", () => {
    const head = pageHead({ section: "Phone book", description: "Get in touch." });
    expect(head.meta?.find((m) => "title" in m)).toEqual({
      title: "Lachlan Heywood — Phone book",
    });
    expect(head.meta?.find((m) => m.name === "description")).toEqual({
      name: "description",
      content: "Get in touch.",
    });
  });
  it("home head omits the dash suffix", () => {
    expect(pageHead({ description: "Portfolio." }).meta?.find((m) => "title" in m)).toEqual({
      title: "Lachlan Heywood",
    });
  });
  it("sitemap paths are absolute, unique, and start with /", () => {
    expect(SITEMAP_PATHS.length).toBeGreaterThan(10);
    expect(new Set(SITEMAP_PATHS).size).toBe(SITEMAP_PATHS.length);
    for (const p of SITEMAP_PATHS) expect(p.startsWith("/")).toBe(true);
  });
  it("sitemap derives from the tree: indexable pages in, noindex out", () => {
    expect(SITEMAP_PATHS[0]).toBe("/");
    expect(SITEMAP_PATHS).toContain("/menu");
    expect(SITEMAP_PATHS).toContain("/menu/phone-book");
    expect(SITEMAP_PATHS).toContain("/menu/games/snake");
    expect(SITEMAP_PATHS).not.toContain("/menu/sim-services"); // noindex easter egg
    expect(SITEMAP_PATHS).not.toContain("/menu/phone-book/search"); // no description
  });
  it("Person JSON-LD has the expected shape", () => {
    const ld = personJsonLd();
    expect(ld["@type"]).toBe("Person");
    expect(typeof ld.name).toBe("string");
  });
});
