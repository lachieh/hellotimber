import { site } from "./content/site";
import { SECTIONS } from "./content/sections";
import { POSTS, postPath, type Post } from "./writing/posts";

export interface PageHeadInput {
  section?: string; // omit for home
  description: string;
}

/** A loose meta-tag shape covering title / named / OG-property tags. */
interface MetaTag {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
}

/** Build a TanStack Start route `head()` return value. */
export function pageHead(input: PageHeadInput): { meta: MetaTag[] } {
  const title = input.section ? `${site.name} — ${input.section}` : site.name;
  return {
    meta: [
      { title },
      { name: "description", content: input.description },
      { property: "og:title", content: title },
      { property: "og:description", content: input.description },
      { property: "og:type", content: "website" },
    ],
  };
}

/** The indexable paths: the homepage and its sections in the phone's menu order, then the posts. */
export const SITEMAP_PATHS: readonly string[] = [
  "/",
  ...SECTIONS.map((section) => section.route),
  ...POSTS.map(postPath),
];

/** The feed's link, for `<link rel="alternate">` on the Writing pages. */
export const FEED_LINK = {
  rel: "alternate",
  type: "application/rss+xml",
  title: `${site.name}: Writing`,
  href: "/rss.xml",
};

/** A post's head: its title, description, canonical URL, Open Graph article and JSON-LD. */
export function postHead(post: Post) {
  const url = `${site.url}${postPath(post)}`;
  const title = `${post.title} — ${site.name}`;
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    url,
    author: { "@type": "Person", name: site.name, url: site.url },
  };
  return {
    meta: [
      { title },
      { name: "description", content: post.summary },
      { property: "og:title", content: post.title },
      { property: "og:description", content: post.summary },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: site.name },
      { property: "article:published_time", content: post.date },
      ...(post.updated === undefined
        ? []
        : [{ property: "article:modified_time", content: post.updated }]),
      { name: "author", content: site.name },
    ],
    links: [{ rel: "canonical", href: url }, FEED_LINK],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(article) }],
  };
}

export function personJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: site.url,
    jobTitle: site.jobTitle,
    description: site.tagline,
    sameAs: site.sameAs,
  };
}
