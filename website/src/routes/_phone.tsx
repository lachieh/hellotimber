import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
import ScreenMirror from "../components/ScreenMirror";
import Desk from "../desk/Desk";
import PhoneSlot from "../phone/PhoneSlot";

/** What the 3D phone fetches once its code runs (phone-3d's defaults), started with the page so
 *  they download alongside that code. as="fetch" + crossOrigin matches three's FileLoader. */
const PHONE_ASSETS = [
  "/models/nokia3310-v3.glb",
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
];

export const Route = createFileRoute("/_phone")({
  head: () => ({
    links: PHONE_ASSETS.map((href) => ({
      rel: "preload",
      href,
      as: "fetch",
      crossOrigin: "anonymous",
    })),
  }),
  component: PhoneLayout,
});

function PhoneLayout() {
  return (
    <main className="phone-layout">
      {/* The desk the phone lies on carries the controls, live state and contact. It renders on
          the server with the phone drawn flat; the 3D phone forms out of it once loaded.
          The stage persists across /, /menu, … — never remounts. Do NOT key this
          by pathname and never move the stage into a leaf route. */}
      <Desk phone={<PhoneSlot />} />

      {/* Everything below is in the DOM (server-rendered, crawlable, screen-reader
          reachable) but visually hidden — the portfolio content stays indexable
          and accessible. */}
      <div className="sr-only">
        <ClientOnly>
          {/* aria-live mirror of the LCD; client-only (constructs the runtime). */}
          <Suspense>
            <ScreenMirror />
          </Suspense>
        </ClientOnly>
        <Outlet /> {/* the per-route content panel — hidden, but present for SEO/AT */}
      </div>
    </main>
  );
}
