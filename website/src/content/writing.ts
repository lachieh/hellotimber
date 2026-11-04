import { formatDate, POSTS, postPath } from "../writing/posts";
import type { PageSection } from "./section";

/**
 * Writing: the posts in `content/writing/*.mdx` (plan 32 Phase 4), from their frontmatter. The
 * phone's list and the index read the same posts; Select on a row opens the post's page (D10).
 */
export const WRITING = {
  kind: "page",
  id: "writing",
  label: "Writing",
  route: "/writing",
  summary: "Technical writing on how things here are built.",
  description: "Technical writing by Lachlan Heywood, starting with how this Nokia 3310 was built.",
  specs: [
    { label: "Posts", value: String(POSTS.length) },
    ...(POSTS[0] === undefined ? [] : [{ label: "Latest", value: POSTS[0].title }]),
    { label: "Feed", value: "RSS, /rss.xml" },
  ],
  lcd: {
    kind: "list",
    items: POSTS.map((post) => ({
      slug: post.slug,
      label: post.row,
      opens: { kind: "link", href: postPath(post) } as const,
    })),
  },
  page: [
    {
      kind: "entries",
      entries: POSTS.map((post) => ({
        title: post.title,
        when: formatDate(post.date),
        datetime: post.date,
        body: post.summary,
        link: { href: postPath(post), label: `Read, ${post.minutes} min` },
      })),
    },
  ],
} as const satisfies PageSection;
