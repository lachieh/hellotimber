import { createPhone, editorApp, nokia3310Menu } from "@hellotimber/phone-core";
import type { AppFactory, Phone } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import type { ScreenRenderer } from "@hellotimber/phone-screen";
import { content } from "../content";

export interface PhoneRuntime {
  phone: Phone;
  renderer: ScreenRenderer;
}

let runtime: PhoneRuntime | null = null;

function buildApps(): Record<string, AppFactory> {
  return {
    // Plan 01 deviation note 2: the multi-tap editor is hosted as an app.
    // onAccept delivery (real contact form) is plan 06 scope.
    "write-message": editorApp({ title: "Message:" }),
    // "snake" is registered in Task 9 (requires plan 04).
  };
}

/**
 * The one phone instance for the whole browser session. Client-only:
 * SSR must never construct it (guard every call site with typeof window).
 */
export function getPhoneRuntime(): PhoneRuntime {
  if (typeof window === "undefined") {
    throw new Error("getPhoneRuntime() is client-only; guard the call site with typeof window");
  }
  if (runtime !== null) return runtime;

  const phone = createPhone({
    menu: nokia3310Menu(content),
    apps: buildApps(),
    carrier: "LACHLAN",
    clock: () => new Date().toTimeString().slice(0, 5), // 24h HH:MM
  });

  // 84×48 native canvas; NearestFilter upscaling happens on the 3D mesh.
  const renderer = createScreenRenderer();
  renderer.render(phone.screen);
  phone.subscribe((snap) => renderer.render(snap.screen));

  // Call divert action nodes are literal redirects (VISION Menu 7).
  phone.on("action", (action) => {
    window.open(action.value, "_blank", "noopener,noreferrer");
  });

  // The machine's only clock: rAF-driven tick (boot animation, long presses,
  // multi-tap timeouts, app ticks all derive from this).
  const loop = (now: number) => {
    phone.tick(now);
    requestAnimationFrame(loop);
  };

  // Power on at first visit. navigate("standby") while off leaves the phone
  // off (plan 01), so standby landings need an explicit power-on; deep links
  // retarget the boot (navigate-while-booting). pressKey advances the machine
  // clock ~1s past performance.now(), so boot holds frame 0 for ~1s — accepted.
  phone.tick(performance.now());
  phone.pressKey("power", 1000);
  requestAnimationFrame(loop);

  runtime = { phone, renderer };
  return runtime;
}
