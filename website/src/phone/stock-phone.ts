import {
  createStockPhone,
  paintStockScreen,
  createMemoryStorage,
  type StockPhoneConfig,
  type StockStorage,
  type T9Dictionary,
} from "@hellotimber/nokia-os";
import type { PhoneKey } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import { PORTFOLIO_SIM, PRELOAD } from "../content/sim";
import { getSettings, subscribeSettings } from "../settings";
import { hostClock, hostDate } from "./host-clock";
import { imeiForHash } from "./imei";
import { createPortfolioNetwork } from "./network";
import { WebAudioSound } from "./stock-sound";

/** What a host chooses about its stock phone; the runtime supplies sound, lights and the boot. */
export type StockRuntimeConfig = Omit<StockPhoneConfig, "sound" | "lights" | "boot" | "t9"> & {
  english: T9Dictionary | undefined;
};

/** `window.localStorage`, or memory where the browser refuses it. */
export function browserStorage(): StockStorage {
  try {
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

/**
 * A stock phone running in the browser: its LCD canvas, Web Audio sound (following the site's
 * mute), its LED state and a frame loop, powered on with a held power key. `stop()` ends the loop
 * and silences it, for a host that replaces or leaves it.
 */
export async function startStockRuntime({ english, ...config }: StockRuntimeConfig) {
  const sound = new WebAudioSound();
  sound.muted = getSettings().muted;
  const unmute = subscribeSettings(() => {
    sound.muted = getSettings().muted;
  });
  const lights = { display: false, keypad: false, enabled: true };
  const phone = createStockPhone({
    ...config,
    boot: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "skip" : "animated",
    ...(english ? { t9: { english } } : {}),
    sound,
    lights: {
      change(event) {
        lights[event.light] = event.on;
      },
    },
  });
  const renderer = createScreenRenderer({ paint: paintStockScreen });
  renderer.render(phone.screen);
  phone.subscribe((snapshot) => renderer.render(snapshot.screen));
  const start = performance.now();
  phone.tick(start);
  phone.send({ type: "down", key: "power" });
  let frame = 0;
  let stopped = false;
  const loop = (now: number) => {
    sound.phoneNow = now;
    phone.tick(now);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      if (!stopped) {
        sound.phoneNow = performance.now();
        phone.tick(sound.phoneNow);
        phone.send({ type: "up", key: "power" });
      }
      resolve();
    }, 1000);
  });
  return {
    phone,
    renderer,
    lights,
    input(key: PhoneKey, action: "down" | "up") {
      sound.start();
      phone.send({ type: action, key });
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      unmute();
      sound.muted = true;
    },
  };
}
export type PhoneRuntime = Awaited<ReturnType<typeof startStockRuntime>>;

/** The English T9 dictionary, or none where its chunk fails to load. */
export function loadEnglishT9(): Promise<T9Dictionary | undefined> {
  return import("@hellotimber/nokia-kit/t9-english").then(
    ({ englishT9 }) => englishT9,
    () => undefined,
  );
}

function createRuntime(english: T9Dictionary | undefined) {
  const storage = browserStorage();
  return startStockRuntime({
    english,
    carrier: "LACHLAN",
    storage,
    sim: PORTFOLIO_SIM,
    preload: PRELOAD,
    imei: imeiForHash(__BUILD_HASH__),
    clock: hostClock,
    date: hostDate,
    network: createPortfolioNetwork({ storage, simId: PORTFOLIO_SIM.id }),
  });
}

let runtime: PhoneRuntime | undefined;
let loading: Promise<PhoneRuntime> | undefined;
export function loadPhoneRuntime(): Promise<PhoneRuntime> {
  if (typeof window === "undefined") throw new Error("Phone runtime is client-only");
  return (loading ??= loadEnglishT9()
    .then(createRuntime)
    .then((ready) => (runtime = ready)));
}
export function getPhoneRuntime(): PhoneRuntime {
  if (runtime) return runtime;
  throw loadPhoneRuntime();
}
