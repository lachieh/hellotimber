import type { Phone } from "@hellotimber/phone-core";
import type { AnyRouter } from "@tanstack/react-router";
import { phonePathFromUrl, urlFromPhonePath } from "./paths";

/**
 * Two-way URL ⇄ phone sync (integration-notes §4). Loop-safety rests on three
 * legs: phone-core's navigate() is a strict no-op (no pathchange) when already
 * at the target; both directions carry an idempotence guard; and a synchronous
 * echo flag swallows the pathchange that a URL-driven navigate() emits.
 * Returns a disconnect function.
 */
export function connectPhoneToRouter(router: AnyRouter, phone: Phone): () => void {
  let echo = false;

  // URL → phone (the URL is the source of truth)
  const unsubRouter = router.subscribe("onResolved", ({ toLocation, pathChanged }) => {
    if (!pathChanged) return;
    const phonePath = phonePathFromUrl(toLocation.pathname);
    if (phone.path === phonePath) return; // idempotence guard
    echo = true;
    try {
      phone.navigate(phonePath);
    } finally {
      echo = false;
    }
  });

  // phone → URL
  const unsubPhone = phone.on("pathchange", (path) => {
    if (echo) return; // we caused this emit
    const url = urlFromPhonePath(path);
    if (router.state.location.pathname === url) return; // idempotence guard
    // standby is a soft state (hold-C / power-off) — don't pollute history
    void router.navigate({ to: url, replace: url === "/" });
  });

  // Initial alignment: URL wins. Boots the phone on deep links; navigate to
  // 'standby' while off is a no-op (the runtime powers on separately).
  phone.navigate(phonePathFromUrl(router.state.location.pathname));

  return () => {
    unsubRouter();
    unsubPhone();
  };
}
