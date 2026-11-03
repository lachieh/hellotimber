import type { Section } from "../content/section";
import { pageHead } from "../seo";

/** A section route's title and description. */
export function sectionHead(section: Section) {
  return pageHead({ section: section.label, description: section.description });
}
