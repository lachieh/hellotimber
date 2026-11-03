import type { PageSection } from "./section";

/** A post in the Writing index. Its page is `/writing/<slug>` (plan 32 Phase 4). */
export interface Post {
  readonly slug: string;
  readonly title: string;
  /** The LCD row, where the title doesn't fit one. */
  readonly row: string;
  readonly summary: string;
}

export const POSTS: readonly Post[] = [
  {
    slug: "how-i-built-a-nokia-3310",
    title: "How I built a Nokia 3310",
    row: "Building a 3310",
    summary:
      "The kernel and firmware split, LCD goldens, the painter, T9, the SMS personas, the 3D model and the reveal.",
  },
];

export const postPath = (post: Post) => `/writing/${post.slug}` as const;

export const WRITING = {
  kind: "page",
  id: "writing",
  label: "Writing",
  route: "/writing",
  summary: "Technical writing on how things here are built.",
  description: "Technical writing by Lachlan Heywood, starting with how this Nokia 3310 was built.",
  specs: [
    { label: "Posts", value: String(POSTS.length) },
    { label: "First", value: POSTS[0]!.title },
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
        body: post.summary,
        link: { href: postPath(post), label: "Read" },
      })),
    },
  ],
} as const satisfies PageSection;
