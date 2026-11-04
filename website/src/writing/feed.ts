// The Writing feed (RSS 2.0): every published post, newest first.
import { site } from "../content/site";
import { postPath, type Post } from "./posts";

const escapeXml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

/** `2026-11-03` → `Tue, 03 Nov 2026 00:00:00 GMT` (RFC 822, as RSS dates are). */
const rssDate = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export function renderFeed(posts: readonly Post[]): string {
  const items = posts.map((post) => {
    const url = `${site.url}${postPath(post)}`;
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${rssDate(post.date)}</pubDate>`,
      `      <description>${escapeXml(post.summary)}</description>`,
      "    </item>",
    ].join("\n");
  });
  const latest = posts.reduce<string | undefined>(
    (max, post) =>
      max === undefined || (post.updated ?? post.date) > max ? (post.updated ?? post.date) : max,
    undefined,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(`${site.name}: Writing`)}</title>`,
    `    <link>${site.url}/writing</link>`,
    `    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>`,
    "    <description>Technical writing by Lachlan Heywood.</description>",
    "    <language>en</language>",
    ...(latest === undefined ? [] : [`    <lastBuildDate>${rssDate(latest)}</lastBuildDate>`]),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
