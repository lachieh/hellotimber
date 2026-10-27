import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import ScreenMirror from "../components/ScreenMirror";
import Desk from "../desk/Desk";

const PhoneStageHost = lazy(() => import("../phone/PhoneStageHost"));

export const Route = createFileRoute("/_phone")({ component: PhoneLayout });

function PhoneLayout() {
  return (
    <main className="phone-layout">
      {/* The desk the phone lies on carries the controls, live state and contact.
          The stage persists across /, /menu, … — never remounts. Do NOT key this
          by pathname and never move the stage into a leaf route. */}
      <ClientOnly fallback={<div className="phone-skeleton" aria-hidden="true" />}>
        <Desk
          phone={
            <div className="phone-fill">
              <Suspense fallback={<div className="phone-skeleton" aria-hidden="true" />}>
                <PhoneStageHost />
              </Suspense>
            </div>
          }
        />
      </ClientOnly>

      {/* Everything below is in the DOM (server-rendered, crawlable, screen-reader
          reachable) but visually hidden — the portfolio content stays indexable
          and accessible. */}
      <div className="sr-only">
        <ClientOnly>
          {/* aria-live mirror of the LCD; client-only (constructs the runtime). */}
          <ScreenMirror />
        </ClientOnly>
        <Outlet /> {/* the per-route content panel — hidden, but present for SEO/AT */}
      </div>
    </main>
  );
}
