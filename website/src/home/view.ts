// What the homepage shows around the phone (plan 32 D8, D9, D11), derived from the route and the
// phone: there's no state of its own to drift from either.
//
//   route `/`         → spread: the highlighted carousel item's section (none at standby: intro)
//   a page section    → docked: the section's page, the phone smaller to one side
//   Chat, Snake       → centred: the phone at real size, a key guide beside it
//   any other route   → none (the phone isn't on it)
import type { ScreenModel } from "@hellotimber/phone-core";
import type { PageSection, PhoneSection, Section, SectionId } from "../content/section";
import { sectionById } from "../content/sections";
import { sectionOfMenuNumber, sectionOfPhonePath, sectionOfRoute } from "./routes";

export type HomeView =
  | { readonly kind: "spread"; readonly section: Section | undefined }
  | { readonly kind: "docked"; readonly section: PageSection }
  | { readonly kind: "centred"; readonly section: PhoneSection };

/** What the phone is showing, as far as the homepage cares. */
export interface PhoneState {
  readonly path: string;
  readonly screen: ScreenModel;
}

/**
 * The section the phone has highlighted: the carousel's item, or the section it's inside;
 * undefined at standby, off or booting.
 */
export function highlightedSection(phone: PhoneState | undefined): SectionId | undefined {
  if (phone === undefined) return undefined;
  if (phone.screen.kind === "menu-carousel") return sectionOfMenuNumber(phone.screen.menuNumber);
  return sectionOfPhonePath(phone.path);
}

/** The view for route `pathname` with `highlighted` on the phone; undefined off the phone's routes. */
export function homeView(
  pathname: string,
  highlighted: SectionId | undefined,
): HomeView | undefined {
  const route = sectionOfRoute(pathname);
  if (route === undefined) return undefined;
  if (route === "home") {
    return {
      kind: "spread",
      section: highlighted === undefined ? undefined : sectionById(highlighted),
    };
  }
  const section = sectionById(route);
  return section.kind === "page" ? { kind: "docked", section } : { kind: "centred", section };
}
