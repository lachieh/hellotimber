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
  it("preserves every sitemap path byte-for-byte in canonical order", () => {
    expect(SITEMAP_PATHS).toEqual([
      "/",
      "/menu",
      "/menu/phone-book",
      "/menu/phone-book/search",
      "/menu/phone-book/service-nos",
      "/menu/messages",
      "/menu/messages/write",
      "/menu/messages/inbox",
      "/menu/chat",
      "/menu/games",
      "/menu/games/snake",
      "/menu/calculator",
      "/menu/reminders",
      "/menu/reminders/view-all",
      "/menu/clock",
      "/menu/sim-services",
      "/menu/sim-services/projects",
      "/menu/sim-services/about",
    ]);
  });
  it("Person JSON-LD has the expected shape", () => {
    const ld = personJsonLd();
    expect(ld["@type"]).toBe("Person");
    expect(typeof ld.name).toBe("string");
  });
});
