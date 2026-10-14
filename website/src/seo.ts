import { site } from "./content/site";
import { indexablePaths } from "./phone/site-tree";

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

/**
 * Canonical, indexable paths derived from PhoneMenu order and typed metadata.
 * SIM services, the 404 twin, is explicitly excluded by its noindex metadata.
 */
export const SITEMAP_PATHS: string[] = ["/", ...indexablePaths()];

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
