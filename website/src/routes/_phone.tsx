import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import ScreenMirror from "../components/ScreenMirror";
import SoundToggle from "../components/SoundToggle";
import { SURROUNDS } from "../surrounds/registry";
import type { Surround } from "../surrounds/registry";

const PhoneStageHost = lazy(() => import("../phone/PhoneStageHost"));

export const Route = createFileRoute("/_phone")({ component: PhoneLayout });

function PhoneLayout() {
  // Persists across /, /menu, … — never remounts. Do NOT key this by
  // pathname and never move the stage into a leaf route.
  const phone = (
    <div className="phone-fill">
      <ClientOnly fallback={<div className="phone-skeleton" aria-hidden="true" />}>
        <Suspense fallback={<div className="phone-skeleton" aria-hidden="true" />}>
          <PhoneStageHost />
        </Suspense>
      </ClientOnly>
    </div>
  );

  return (
    <main className="phone-layout">
      <ClientOnly fallback={phone}>
        <SurroundedPhone phone={phone} />
      </ClientOnly>

      {/* Everything below is in the DOM (server-rendered, crawlable, screen-reader
          reachable) but visually hidden — the portfolio content stays indexable
          and accessible. */}
      <div className="sr-only">
        <ClientOnly>
          {/* SoundToggle reads localStorage, so it lives inside ClientOnly. */}
          <SoundToggle />
          {/* aria-live mirror of the LCD; client-only (constructs the runtime). */}
          <ScreenMirror />
        </ClientOnly>
        <Outlet /> {/* the per-route content panel — hidden, but present for SEO/AT */}
      </div>
    </main>
  );
}

const LAYOUT_KEY = "hellotimber.layout";

/**
 * The prototype surround picked by `?layout=<slug>`, or the bare phone. The pick lasts
 * for the browser session (the router bridge rewrites the URL as the phone navigates);
 * `?layout=` with no slug clears it.
 */
function SurroundedPhone({ phone }: { phone: React.ReactNode }) {
  const [Chosen] = useState<Surround | undefined>(() => {
    const param = new URLSearchParams(window.location.search).get("layout");
    try {
      if (param === "") window.sessionStorage.removeItem(LAYOUT_KEY);
      else if (param !== null) window.sessionStorage.setItem(LAYOUT_KEY, param);
    } catch {
      // storage unavailable — the pick lives only in this URL
    }
    let slug = param;
    try {
      slug ??= window.sessionStorage.getItem(LAYOUT_KEY);
    } catch {
      // as above
    }
    return slug === null || slug === "" ? undefined : SURROUNDS[slug];
  });
  if (Chosen === undefined) return phone;
  return (
    <Suspense fallback={phone}>
      <Chosen phone={phone} />
    </Suspense>
  );
}
