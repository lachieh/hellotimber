// The homepage's URL ⇄ phone map (plan 32 D9, D11): each section is one top-level item of the
// homepage firmware and one route. The phone anywhere inside a section is on its route; at
// standby or the carousel it is on `/`. Pure: the router bridge (`phone/router-sync.ts`) uses it.
import type { SectionId } from "../content/section";
import { SECTIONS } from "../content/sections";

/** A section's top-level item: its slug in the tree (Snake lives in Games). */
export const SECTION_SLUGS: Readonly<Record<SectionId, string>> = {
  about: "about",
  work: "work",
  writing: "writing",
  now: "now",
  contact: "contact",
  chat: "chat",
  snake: "games",
};

/** Where landing on a section's route opens the phone. */
export const SECTION_PHONE_PATHS: Readonly<Record<SectionId, string>> = {
  about: "menu/about",
  work: "menu/work",
  writing: "menu/writing",
  now: "menu/now",
  contact: "menu/contact",
  chat: "menu/chat",
  snake: "menu/games/snake",
};

/** `/about/` → `/about`; `/` stays. */
function canonical(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** The section a route shows, `home` for `/`; undefined for a route the phone isn't on. */
export function sectionOfRoute(pathname: string): SectionId | "home" | undefined {
  const path = canonical(pathname);
  if (path === "/") return "home";
  return SECTIONS.find((section) => section.route === path)?.id;
}

/** The section whose top-level item has `slug`. */
export function sectionOfSlug(slug: string): SectionId | undefined {
  return SECTIONS.find((section) => SECTION_SLUGS[section.id] === slug)?.id;
}

/** The section at carousel position `menuNumber` (1-based). */
export function sectionOfMenuNumber(menuNumber: number): SectionId | undefined {
  return SECTIONS[menuNumber - 1]?.id;
}

/** The section the phone path `path` is inside (`menu/work/tambo` → work). */
export function sectionOfPhonePath(path: string): SectionId | undefined {
  const [root, slug] = path.split("/");
  return root === "menu" && slug !== undefined ? sectionOfSlug(slug) : undefined;
}

/** The route of phone path `path`: its section's, else `/` (standby, the carousel). */
export function routeOfPhonePath(path: string): string {
  const section = sectionOfPhonePath(path);
  return section === undefined ? "/" : SECTIONS.find((s) => s.id === section)!.route;
}

/** Whether `pathname` is the route of phone path `path`. */
export function onRoute(pathname: string, path: string): boolean {
  return canonical(pathname) === routeOfPhonePath(path);
}
