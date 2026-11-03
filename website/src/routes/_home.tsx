import { ClientOnly, createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Suspense } from "react";
import ScreenMirror from "../components/ScreenMirror";
import { Colophon, Contents, HomeViewContext } from "../home/Home";
import { useHighlightedSection, useRouterSync } from "../home/use-phone";
import { homeView } from "../home/view";
import PhoneSlot from "../phone/PhoneSlot";
import "../home/home.css";

/** What the 3D phone fetches once its code runs (phone-3d's defaults), started with the page so
 *  they download alongside that code. as="fetch" + crossOrigin matches three's FileLoader. */
const PHONE_ASSETS = [
  "/models/nokia3310-v3.glb",
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
];

export const Route = createFileRoute("/_home")({
  head: () => ({
    links: PHONE_ASSETS.map((href) => ({
      rel: "preload",
      href,
      as: "fetch",
      crossOrigin: "anonymous",
    })),
  }),
  component: HomeLayout,
});

/**
 * The homepage and its section routes around one phone. The phone stage persists across `/`,
 * `/about`, … and never remounts: don't key this by pathname or move the stage into a leaf route.
 */
function HomeLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const highlighted = useHighlightedSection();
  const view = homeView(pathname, highlighted);
  useRouterSync();
  return (
    <div className="home" data-view={view?.kind ?? "spread"}>
      <header className="home-side">
        <Contents />
        <Colophon />
      </header>
      <section className="home-phone" aria-label="The phone" aria-describedby="home-phone-keys">
        <p id="home-phone-keys" className="sr-only">
          A working Nokia 3310. Arrow keys scroll, Enter is the middle key, Escape or Backspace is
          C, 0 to 9, star and hash type, and P is power. What the screen shows is read out as it
          changes.
        </p>
        <div className="home-phone__shadow" aria-hidden="true" />
        <div className="home-phone__stage">
          <PhoneSlot />
        </div>
        <ClientOnly>
          <Suspense>
            <ScreenMirror />
          </Suspense>
        </ClientOnly>
      </section>
      <main className="home-main">
        <HomeViewContext.Provider value={view}>
          <Outlet />
        </HomeViewContext.Provider>
      </main>
    </div>
  );
}
