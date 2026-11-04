// A section of the homepage (plan 32 D14): one typed record that both the phone's LCD and the
// section's HTML page read, so the two can't drift apart.
import type { ExternalLink } from "./links";

export type SectionId = "about" | "work" | "writing" | "now" | "contact" | "chat" | "snake";
export type SectionRoute = `/${SectionId}`;

/** A row of a spread's spec sheet. */
export interface Spec {
  readonly label: string;
  readonly value: string;
}

/** What a section shows on the LCD: reader pages of short text, or a list of items. */
export type Lcd =
  | { readonly kind: "reader"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly LcdItem[] };

/** A list row on the LCD: Select reads its text, or opens its link. */
export interface LcdItem {
  readonly slug: string;
  /** One row of the stock small font. */
  readonly label: string;
  readonly opens: { readonly kind: "reader"; readonly text: string } | LinkTarget;
}

export interface LinkTarget {
  readonly kind: "link";
  /** An absolute URL opens in a new tab; a site path navigates. */
  readonly href: string;
}

/** An entry on a section's page: a job, a project, a post. */
export interface PageEntry {
  readonly title: string;
  readonly when?: string;
  /** `when` as a machine-readable date (`YYYY-MM-DD`), set as `<time>`. */
  readonly datetime?: string;
  readonly body: string;
  readonly link?: { readonly href: string; readonly label: string; readonly rel?: string };
}

/** The long form: paragraphs, entries and link lists, in order. */
export type PageBlock =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "entries"; readonly entries: readonly PageEntry[] }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "links"; readonly links: readonly ExternalLink[] };

interface SectionBase {
  readonly id: SectionId;
  /** The section's name: the carousel label, the contents link and the page heading. */
  readonly label: string;
  readonly route: SectionRoute;
  /** One line under the name on the spread. */
  readonly summary: string;
  /** The page's meta description. */
  readonly description: string;
  readonly specs: readonly Spec[];
}

/** A section with its own page: the phone docks beside it. */
export interface PageSection extends SectionBase {
  readonly kind: "page";
  readonly lcd: Lcd;
  readonly page: readonly PageBlock[];
}

/** A section that is the phone itself (Chat, Snake): the phone centres, with a key guide. */
export interface PhoneSection extends SectionBase {
  readonly kind: "phone";
  readonly guide: readonly Spec[];
}

export type Section = PageSection | PhoneSection;
