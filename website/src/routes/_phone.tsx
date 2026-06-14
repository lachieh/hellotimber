import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import ScreenMirror from "../components/ScreenMirror";
import SoundToggle from "../components/SoundToggle";

const PhoneStageHost = lazy(() => import("../phone/PhoneStageHost"));

export const Route = createFileRoute("/_phone")({ component: PhoneLayout });

function PhoneLayout() {
  return (
    <main className="phone-layout">
      {/* The phone fills the whole viewport — it is the only visible thing.
          Persists across /, /menu, … — never remounts. Do NOT key this by
          pathname and never move the stage into a leaf route. */}
      <div className="phone-fill">
        <ClientOnly fallback={<div className="phone-skeleton" aria-hidden="true" />}>
          <Suspense fallback={<div className="phone-skeleton" aria-hidden="true" />}>
            <PhoneStageHost />
          </Suspense>
        </ClientOnly>
      </div>

      {/* Everything below is in the DOM (server-rendered, crawlable, screen-reader
          reachable) but visually hidden — the page shows only the phone, while the
          portfolio content stays indexable and accessible. */}
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
