import { site } from "./content/site";

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

/** Canonical, indexable paths — the phone sitemap (VISION table). Catch-all + 404 excluded. */
export const SITEMAP_PATHS: string[] = [
  "/",
  "/menu",
  "/menu/phone-book",
  "/menu/messages",
  "/menu/messages/inbox",
  "/menu/messages/write",
  "/menu/chat",
  "/menu/call-register",
  "/menu/tones",
  "/menu/settings",
  "/menu/call-divert",
  "/menu/games",
  "/menu/games/snake",
  "/menu/calculator",
  "/menu/reminders",
  "/menu/clock",
  "/menu/profiles",
  "/menu/sim-services",
];

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
