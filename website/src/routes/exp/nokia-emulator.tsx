import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ExpFrame } from "../../exp/ExpFrame";
import { pageHead } from "../../seo";

/** The stage, the phone and the panel load after the frame, in their own chunks. */
const NokiaEmulator = lazy(() => import("../../exp/nokia-emulator/NokiaEmulator"));

const DESCRIPTION =
  "The Nokia 3310's v6.39 firmware, reproduced pixel for pixel and running in your browser, with an inspector, world controls and a studio stage.";

/** What the emulator fetches once its code runs: the model and its decoder, and the panel's type. */
const PRELOADS = [
  "/models/nokia3310-v3.glb",
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
];

export const Route = createFileRoute("/exp/nokia-emulator")({
  head: () => ({
    ...pageHead({ section: "Nokia 3310 emulator", description: DESCRIPTION }),
    links: [
      ...PRELOADS.map((href) => ({
        rel: "preload",
        href,
        as: "fetch",
        crossOrigin: "anonymous" as const,
      })),
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: NokiaEmulatorRoute,
});

function NokiaEmulatorRoute() {
  return (
    <ExpFrame
      title="Nokia 3310 emulator"
      subtitle="stock firmware v6.39"
      writeUp={{ href: "/writing/how-i-built-a-nokia-3310", label: "How I built it" }}
    >
      <ClientOnly fallback={<p className="exp-loading">Loading the emulator…</p>}>
        <Suspense fallback={<p className="exp-loading">Loading the emulator…</p>}>
          <NokiaEmulator />
        </Suspense>
      </ClientOnly>
    </ExpFrame>
  );
}
