import { describe, expect, it } from "vite-plus/test";
import { pageHead, personJsonLd, SITEMAP_PATHS } from "../src/seo";
import { POSTS } from "../src/writing/posts";

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
  it("lists the homepage, its sections in menu order and the posts, and nothing else (D15)", () => {
    expect(SITEMAP_PATHS).toEqual([
      "/",
      "/about",
      "/work",
      "/writing",
      "/now",
      "/contact",
      "/chat",
      "/snake",
      ...POSTS.map((post) => `/writing/${post.slug}`),
    ]);
  });
  it("Person JSON-LD has the expected shape", () => {
    const ld = personJsonLd();
    expect(ld["@type"]).toBe("Person");
    expect(typeof ld.name).toBe("string");
  });
});
