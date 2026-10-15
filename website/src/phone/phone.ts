import { createPhone } from "@hellotimber/phone-core";
import type { Phone, PhoneKey } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import { paintStockScreen } from "@hellotimber/nokia-os";
import type { ScreenRenderer } from "@hellotimber/phone-screen";
import { SITE_STANDBY_KEYS, siteMenu } from "../content/menu";
import { getSettings } from "../settings";
import { handleSound } from "./audio";
import { bindPhoneNotices } from "./notice-binding";
import { artToBitmap, SCREENSAVER_ART } from "./pixel-art";

export interface PhoneRuntime {
  phone: Phone;
  renderer: ScreenRenderer;
  /** Funnel for ALL key input (deviation 10): detects *#06# + tracks idle. */
  input(key: PhoneKey, action: "down" | "up"): void;
  /** True while the idle screensaver is showing. */
  isScreensaver(): boolean;
  /** True once *#06# has been entered — the SIM panel reveals the IMEI. */
  isImeiRevealed(): boolean;
}

let runtime: PhoneRuntime | null = null;

/**
 * The one phone instance for the whole browser session. Client-only:
 * SSR must never construct it (guard every call site with typeof window).
 */
export function getPhoneRuntime(): PhoneRuntime {
  if (typeof window === "undefined") {
    throw new Error("getPhoneRuntime() is client-only; guard the call site with a browser check");
  }
  if (runtime !== null) return runtime;

  // Reduced motion → skip the boot animation entirely (a11y, deviation/Task 8).
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const phone = createPhone({
    menu: siteMenu,
    carrier: "LACHLAN",
    standbyKeys: SITE_STANDBY_KEYS,
    clock: () => new Date().toTimeString().slice(0, 5), // 24h HH:MM
    ...(reduceMotion ? { bootMs: 0 } : {}),
  });
  bindPhoneNotices(phone);

  // 84×48 native canvas; NearestFilter upscaling happens on the 3D mesh.
  // The saved Welcome note shows during boot (deviation 5: renderer-lifetime).
  // Render the LCD with the stock v6.39 painter from @hellotimber/nokia-os so this
  // website actually consumes that package and its verified fonts/icons/screens.
  const renderer = createScreenRenderer({ paint: paintStockScreen });
  renderer.render(phone.screen);
  phone.subscribe((snap) => renderer.render(snap.screen));

  // Call divert action nodes are literal redirects (VISION Menu 7).
  phone.on("action", (action) => {
    window.open(action.value, "_blank", "noopener,noreferrer");
  });

  // Key beeps (and future phone-core tones) — settings/mute applied inside.
  phone.on("sound", handleSound);

  // ── Easter eggs: *#06# IMEI + idle screensaver (deviations 9/10) ─────────
  const SCREENSAVER_IDLE_MS = 30_000;
  const screensaverFrame = artToBitmap(SCREENSAVER_ART);
  let lastTickMs = 0;
  let idleSinceMs = 0;
  let screensaverOn = false;
  let showImei = false;
  let recent = ""; // last few single-char keys, for *#06# detection

  /** The input funnel every key passes through (keyboard + 3D taps). */
  function input(key: PhoneKey, action: "down" | "up"): void {
    idleSinceMs = lastTickMs;
    if (screensaverOn) {
      // Any key dismisses the screensaver and is otherwise swallowed.
      if (action === "down") {
        screensaverOn = false;
        renderer.render(phone.screen);
      }
      return;
    }
    if (action === "down" && key.length === 1) {
      recent = (recent + key).slice(-5);
      if (recent === "*#06#") {
        showImei = true;
        phone.navigate("menu/sim-services");
      }
    }
    phone.send({ type: action, key });
  }

  // The machine's only clock: rAF-driven tick (boot animation, long presses,
  // multi-tap timeouts, app ticks all derive from this). Idle screensaver is
  // tracked here too.
  const loop = (now: number) => {
    lastTickMs = now;
    phone.tick(now);
    if (
      !screensaverOn &&
      getSettings().screenSaver &&
      phone.screen.kind === "standby" &&
      now - idleSinceMs > SCREENSAVER_IDLE_MS
    ) {
      screensaverOn = true;
      renderer.render({ kind: "custom", appId: "screensaver", frame: screensaverFrame });
    }
    requestAnimationFrame(loop);
  };

  // Power on at first visit. navigate("standby") while off leaves the phone
  // off (plan 01), so standby landings need an explicit power-on; deep links
  // retarget the boot (navigate-while-booting). pressKey advances the machine
  // clock ~1s past performance.now(), so boot holds frame 0 for ~1s — accepted.
  phone.tick(performance.now());
  idleSinceMs = performance.now();
  phone.pressKey("power", 1000);
  requestAnimationFrame(loop);

  runtime = {
    phone,
    renderer,
    input,
    isScreensaver: () => screensaverOn,
    isImeiRevealed: () => showImei,
  };
  return runtime;
}
