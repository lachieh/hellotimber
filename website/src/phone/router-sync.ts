import type { Phone } from "@hellotimber/phone-core";
import type { AnyRouter } from "@tanstack/react-router";
import {
  onRoute,
  routeOfPhonePath,
  SECTION_PHONE_PATHS,
  SECTION_SLUGS,
  sectionOfPhonePath,
  sectionOfRoute,
} from "../home/routes";

/**
 * Two-way URL ⇄ phone sync for the homepage (plan 32 D9): entering a section on the phone goes to
 * its route, leaving it for the carousel goes to `/`; landing on a route opens the phone there.
 * Loop safety: each direction does nothing while the URL and the phone already agree
 * (`onRoute`), and a flag swallows the path changes a URL-driven move makes. Returns a disconnect
 * function.
 */
export function connectPhoneToRouter(router: AnyRouter, phone: Phone): () => void {
  let echo = false;

  const align = (pathname: string) => {
    const route = sectionOfRoute(pathname);
    if (route === undefined || onRoute(pathname, phone.path)) return;
    echo = true;
    try {
      if (route === "home") backToCarousel(phone);
      else phone.navigate(SECTION_PHONE_PATHS[route]);
    } finally {
      echo = false;
    }
  };

  const unsubRouter = router.subscribe("onResolved", ({ toLocation, pathChanged }) => {
    if (pathChanged) align(toLocation.pathname);
  });

  const unsubPhone = phone.on("pathchange", (path) => {
    if (echo || onRoute(router.state.location.pathname, path)) return;
    // Standby is a soft state (C held, power off): it doesn't add a history entry.
    void router.navigate({ to: routeOfPhonePath(path), replace: path === "standby" });
  });

  // The URL wins on load: a deep link opens the phone there (booting it first).
  align(router.state.location.pathname);

  return () => {
    unsubRouter();
    unsubPhone();
  };
}

/**
 * Leaves the section the phone is in for the carousel on its item, as C does from the section's
 * first screen: the section opened afresh (no typed digits, no paused game), then C.
 */
function backToCarousel(phone: Phone): void {
  const section = sectionOfPhonePath(phone.path);
  if (section === undefined) return;
  phone.navigate("menu");
  phone.navigate(`menu/${SECTION_SLUGS[section]}`);
  phone.pressKey("c");
}
