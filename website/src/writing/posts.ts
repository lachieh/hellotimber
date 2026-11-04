// The posts in `website/content/writing/`, read from their frontmatter at build time. The Writing
// index, the post pages, the feed, the sitemap and the homepage phone's Writing list all read
// this one list.
import { parseFrontmatter, readingMinutes, type PostMeta } from "./frontmatter";

/** What the `?frontmatter` import of an `.mdx` file gives (vite.config.ts `writingFrontmatter`). */
export interface FrontmatterModule {
  readonly block: string;
  readonly words: number;
}

export interface Post extends PostMeta {
  readonly slug: string;
  /** The LCD row: `lcd`, else the title. */
  readonly row: string;
  readonly minutes: number;
}

/** `../../content/writing/how-i-built.mdx` → `how-i-built`. */
export function slugOfFile(file: string): string {
  const name = file.split("/").at(-1)!;
  const slug = name.replace(/\.mdx$/, "");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${file}: a post's file name must be a lower-case slug.`);
  }
  return slug;
}

/** Posts from their files' frontmatter, newest first; drafts only when `drafts`. */
export function postsFrom(
  files: Readonly<Record<string, FrontmatterModule>>,
  { drafts }: { drafts: boolean },
): Post[] {
  return Object.entries(files)
    .map(([file, { block, words }]): Post => {
      const meta = parseFrontmatter(block, file);
      return {
        ...meta,
        slug: slugOfFile(file),
        row: meta.lcd ?? meta.title,
        minutes: readingMinutes(words),
      };
    })
    .filter((post) => drafts || !post.draft)
    .sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1));
}

const FILES = import.meta.glob<FrontmatterModule>("../../content/writing/*.mdx", {
  query: "?frontmatter",
  import: "default",
  eager: true,
});

/** Every published post (and, outside production builds, the drafts), newest first. */
export const POSTS: readonly Post[] = postsFrom(FILES, { drafts: !import.meta.env.PROD });

export const postPath = (post: Pick<Post, "slug">) => `/writing/${post.slug}` as const;

export function postBySlug(slug: string): Post | undefined {
  return POSTS.find((post) => post.slug === slug);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-11-03` → `3 Nov 2026`, as the index and the post pages set dates. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month! - 1]} ${year}`;
}
