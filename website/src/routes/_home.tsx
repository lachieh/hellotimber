import type { Callout } from "@hellotimber/phone-3d/sketch";
import { ClientOnly, createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import ScreenMirror from "../components/ScreenMirror";
import { Colophon, Contents, ExhibitCaption, HomeViewContext, RunningHead } from "../home/Home";
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

/**
 * Spec callouts: leader lines from the formed phone's parts to labels beside it (plan 32 D7).
 * Off: judged in the browser, they compete with the spread for the same reading path and repeat
 * the caption's dimensions; the drawing's own dimension lines carry the spec-sheet idea.
 */
const SPEC_CALLOUTS = false;

const CALLOUTS: readonly Callout[] = [
  { target: "screen", label: "Display, 84 × 48 px" },
  { target: "key_navi", label: "Navi key: Menu, Select" },
  { target: "key_c", label: "C: back, clear" },
  { target: "key_5", label: "Keypad, T9" },
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
  // Narrow screens dock the phone as a strip above a section's page; this opens it to full size.
  // Leaving the page (by its route) closes it again.
  const [opened, setOpened] = useState<string | undefined>(undefined);
  const open = view?.kind === "docked" && opened === pathname;
  const callouts = SPEC_CALLOUTS && view?.kind !== "docked" ? CALLOUTS : undefined;
  return (
    <div className="cat" data-view={view?.kind ?? "spread"} data-phone={open ? "open" : undefined}>
      <RunningHead />
      <Contents marked={view?.section} />
      <section className="cat-exhibit" aria-label="The phone" aria-describedby="cat-phone-keys">
        <p id="cat-phone-keys" className="sr-only">
          A working Nokia 3310. Arrow keys scroll, Enter is the middle key, Escape or Backspace is
          C, 0 to 9, star and hash type, and P is power. What the screen shows is read out as it
          changes.
        </p>
        <div className="cat-exhibit__stage">
          <div className="cat-exhibit__shadow" aria-hidden="true" />
          <PhoneSlot callouts={callouts} />
          {view?.kind === "docked" && (
            // The strip's phone is too small to press: a tap opens it (the toggle below does the
            // same for the keyboard and screen readers).
            <button
              type="button"
              className="cat-exhibit__open"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => setOpened(pathname)}
            />
          )}
        </div>
        <div className="cat-exhibit__caption">
          <ExhibitCaption view={view} />
          {view?.kind === "docked" && (
            <button
              type="button"
              className="cat-exhibit__toggle"
              aria-expanded={open}
              onClick={() => setOpened(open ? undefined : pathname)}
            >
              {open ? "Smaller" : "Use the phone"}
            </button>
          )}
        </div>
        <ClientOnly>
          <Suspense>
            <ScreenMirror />
          </Suspense>
        </ClientOnly>
      </section>
      <main className="cat-main">
        <HomeViewContext.Provider value={view}>
          <Outlet />
        </HomeViewContext.Provider>
      </main>
      <Colophon />
    </div>
  );
}
