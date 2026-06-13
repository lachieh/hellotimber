import type { SiteMeta } from "./types";

// SAMPLE DATA — replace with real copy ──────────────────────────────────────
// Canonical site facts: drive SEO meta, the sitemap origin, and the JSON-LD
// Person. `url` is the deployed origin with NO trailing slash.
export const site: SiteMeta = {
  url: "https://hellotimber.example", // SAMPLE DATA — replace with real copy (the deployed origin)
  name: "Lachlan Heywood",
  jobTitle: "Software Engineer", // SAMPLE DATA — replace with real copy
  description:
    "Lachlan Heywood's portfolio: a working Nokia 3310 in three.js. Every menu on the phone is a page on the site.", // SAMPLE DATA — replace with real copy
  tagline: "Engineer. This portfolio is a working Nokia 3310.", // SAMPLE DATA — replace with real copy
  sameAs: [
    "https://github.com/example-handle", // SAMPLE DATA — replace with real copy
    "https://www.linkedin.com/in/example-handle", // SAMPLE DATA — replace with real copy
  ],
};
// ── end SAMPLE DATA ─────────────────────────────────────────────────────────
