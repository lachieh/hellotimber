import { describe, expect, it } from "vite-plus/test";
import { WRITING } from "../src/content/writing";
import { SITEMAP_PATHS, postHead } from "../src/seo";
import { renderFeed } from "../src/writing/feed";
import {
  parseFrontmatter,
  proseWords,
  readingMinutes,
  splitFrontmatter,
} from "../src/writing/frontmatter";
import { formatDate, POSTS, postsFrom, slugOfFile } from "../src/writing/posts";

const block = (lines: string[]) => lines.join("\n");
const VALID = block([
  "title: How I built a Nokia 3310",
  "lcd: Building a 3310",
  "date: 2026-11-03",
  'summary: "The kernel: and the firmware."',
  "draft: false",
]);

describe("frontmatter", () => {
  it("splits the YAML block from the body", () => {
    expect(splitFrontmatter("---\ntitle: A\n---\n\n# Body\n")).toEqual({
      block: "title: A",
      body: "\n# Body\n",
    });
    expect(splitFrontmatter("# No frontmatter")).toEqual({ block: "", body: "# No frontmatter" });
  });

  it("reads the typed fields, quoted or bare", () => {
    expect(parseFrontmatter(VALID, "a.mdx")).toEqual({
      title: "How I built a Nokia 3310",
      lcd: "Building a 3310",
      date: "2026-11-03",
      updated: undefined,
      summary: "The kernel: and the firmware.",
      draft: false,
    });
    expect(
      parseFrontmatter(
        block(["title: 'It''s'", "date: 2026-01-02", "summary: S", "draft: true"]),
        "b",
      ).title,
    ).toBe("It's");
  });

  it("rejects what a post can't be published with, naming the file and field", () => {
    expect(() => parseFrontmatter("date: 2026-11-03\nsummary: S", "x.mdx")).toThrow(
      'x.mdx: "title" is required.',
    );
    expect(() => parseFrontmatter(`${VALID}\ntags: a`, "x.mdx")).toThrow(
      'unknown frontmatter field "tags"',
    );
    expect(() => parseFrontmatter(VALID.replace("2026-11-03", "2026-02-30"), "x.mdx")).toThrow(
      '"date" must be a YYYY-MM-DD date',
    );
    expect(() => parseFrontmatter(VALID.replace("draft: false", "draft: yes"), "x.mdx")).toThrow(
      '"draft" must be true or false',
    );
    expect(() => parseFrontmatter(`${VALID}\nupdated: 2026-11-01`, "x.mdx")).toThrow(
      '"updated" (2026-11-01) is before "date"',
    );
    expect(() => parseFrontmatter(`${VALID}\ntitle: again`, "x.mdx")).toThrow(
      '"title" is set twice',
    );
  });

  it("counts prose, not code or JSX, for the reading time", () => {
    const body = [
      'import { X } from "y";',
      "One two three.",
      "```ts",
      "const not = counted;",
      "```",
      '<LiveLcd start="menu" caption="not counted either" />',
      "Four five.",
    ].join("\n");
    expect(proseWords(body)).toBe(5);
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(2300)).toBe(10);
  });
});

describe("the post list", () => {
  const file = (meta: string) => ({ block: meta, words: 460 });

  it("comes from the files' frontmatter, newest first, with drafts only when asked", () => {
    const files = {
      "../../content/writing/older.mdx": file(VALID.replace("2026-11-03", "2026-01-01")),
      "../../content/writing/newer.mdx": file(VALID),
      "../../content/writing/wip.mdx": file(VALID.replace("draft: false", "draft: true")),
    };
    expect(postsFrom(files, { drafts: false }).map((p) => p.slug)).toEqual(["newer", "older"]);
    expect(postsFrom(files, { drafts: true }).map((p) => p.slug)).toEqual([
      "newer",
      "wip",
      "older",
    ]);
    const [post] = postsFrom(files, { drafts: false });
    expect(post).toMatchObject({ row: "Building a 3310", minutes: 2 });
  });

  it("uses the title as the LCD row without an lcd field", () => {
    const files = { "x/plain.mdx": file(VALID.replace("lcd: Building a 3310\n", "")) };
    expect(postsFrom(files, { drafts: false })[0]!.row).toBe("How I built a Nokia 3310");
  });

  it("takes slugs from file names", () => {
    expect(slugOfFile("../../content/writing/how-i-built-a-nokia-3310.mdx")).toBe(
      "how-i-built-a-nokia-3310",
    );
    expect(() => slugOfFile("x/Not A Slug.mdx")).toThrow("lower-case slug");
  });

  it("holds the first post, from content/writing", () => {
    expect(POSTS.map((p) => p.slug)).toContain("how-i-built-a-nokia-3310");
  });

  it("feeds the phone's Writing list and the index from the same posts", () => {
    expect(WRITING.lcd.items.map((item) => [item.label, item.opens.href])).toEqual(
      POSTS.map((post) => [post.row, `/writing/${post.slug}`]),
    );
    expect(WRITING.page[0].entries.map((entry) => entry.title)).toEqual(POSTS.map((p) => p.title));
  });

  it("sets dates as the catalogue does", () => {
    expect(formatDate("2026-11-03")).toBe("3 Nov 2026");
  });
});

describe("feed, sitemap and head", () => {
  const post = postsFrom(
    { "x/a-post.mdx": { block: VALID.replace("Nokia 3310", "Nokia <3310> & co"), words: 10 } },
    { drafts: false },
  )[0]!;

  it("renders RSS 2.0 with escaped text and RFC 822 dates", () => {
    const xml = renderFeed([post]);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<title>How I built a Nokia &lt;3310&gt; &amp; co</title>");
    expect(xml).toContain("<link>https://hellotimber.com/writing/a-post</link>");
    expect(xml).toContain("<pubDate>Tue, 03 Nov 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<lastBuildDate>Tue, 03 Nov 2026 00:00:00 GMT</lastBuildDate>");
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("renders an empty channel without posts", () => {
    const xml = renderFeed([]);
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("lastBuildDate");
  });

  it("lists every post in the sitemap after the sections", () => {
    expect(SITEMAP_PATHS.slice(8)).toEqual(POSTS.map((p) => `/writing/${p.slug}`));
  });

  it("gives a post a canonical URL and an article's Open Graph", () => {
    const head = postHead(post);
    expect(head.links[0]).toEqual({
      rel: "canonical",
      href: "https://hellotimber.com/writing/a-post",
    });
    expect(head.meta).toContainEqual({ property: "og:type", content: "article" });
    expect(head.meta).toContainEqual({ property: "article:published_time", content: "2026-11-03" });
    expect(JSON.parse(head.scripts[0]!.children)).toMatchObject({
      "@type": "BlogPosting",
      datePublished: "2026-11-03",
    });
  });
});
