/** Site-wide metadata for SEO/JSON-LD. */
export interface SiteMeta {
  url: string; // canonical origin, NO trailing slash
  name: string;
  jobTitle: string;
  description: string; // default meta description
  tagline: string; // short one-liner for the home head + JSON-LD
  sameAs: string[]; // social profile URLs for JSON-LD
}
